import { config } from "./config";

// Platform check - reusePort only works on Linux
const isLinux = process.platform === "linux";
if (!isLinux) {
  console.warn(
    "⚠️  Clustering requires Linux (SO_REUSEPORT). Running single process...",
  );
  await import("./index");
  // Keep process alive (index.ts handles the server)
  await new Promise(() => {});
}

const workerCount = config.clusterWorkers || navigator.hardwareConcurrency;
const workers: Map<number, ReturnType<typeof Bun.spawn>> = new Map();
let shuttingDown = false;

console.log(`🚀 Starting PixelServe cluster with ${workerCount} workers...`);

function spawnWorker(id: number) {
  const worker = Bun.spawn({
    cmd: ["bun", "src/index.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      PIXELSERVE_WORKER_ID: String(id),
    },
    stdout: "inherit",
    stderr: "inherit",
  });

  workers.set(id, worker);

  // Auto-respawn on crash
  worker.exited.then((exitCode) => {
    workers.delete(id);
    if (!shuttingDown && exitCode !== 0) {
      console.log(`⚠️  Worker #${id} crashed (exit ${exitCode}), respawning...`);
      spawnWorker(id);
    }
  });
}

// Spawn all workers
for (let i = 0; i < workerCount; i++) {
  spawnWorker(i);
}

// Graceful shutdown
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n🛑 Shutting down cluster...");

  for (const [_id, worker] of workers) {
    worker.kill();
  }

  // Give workers time to cleanup, then exit
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep master process alive
await Promise.all(Array.from(workers.values()).map((worker) => worker.exited));
