import dns from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "../config";
import { ForbiddenError, ValidationError } from "./errors";

const PRIVATE_IP_RANGES = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-9])\./, // Carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fe80:/, // IPv6 link-local
  /^fc00:/, // IPv6 unique local
  /^fd/, // IPv6 unique local
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((range) => range.test(ip));
}

function isDnsNotFound(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

export async function validateUrl(urlString: string): Promise<URL> {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ValidationError("Invalid URL format");
  }

  // Only allow HTTP/HTTPS
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ForbiddenError("Only HTTP/HTTPS URLs are allowed");
  }

  // Block known dangerous hostnames
  const hostname = url.hostname.toLowerCase();

  // Check if this is a self-reference (request to our own server)
  const isSelfReference =
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1") &&
    (url.pathname.startsWith("/og") || url.pathname.startsWith("/image"));

  // Allow self-reference if configured (for /image -> /og chaining)
  if (isSelfReference && config.allowSelfReference) {
    return url;
  }

  if (
    config.blockedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    )
  ) {
    throw new ForbiddenError("Blocked domain");
  }

  // Check allowlist if configured
  if (config.allowedDomains.length > 0) {
    const isAllowed = config.allowedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );
    if (!isAllowed) {
      throw new ForbiddenError("Domain not in allowlist");
    }
  }

  // Check if hostname is an IP literal — validate directly without DNS
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new ForbiddenError("Private IP addresses are not allowed");
    }
    return url;
  }

  // DNS resolution check to prevent SSRF via DNS rebinding
  const [v4Result, v6Result] = await Promise.allSettled([
    dns.resolve4(hostname),
    dns.resolve6(hostname),
  ]);

  const addresses: string[] =
    v4Result.status === "fulfilled" ? v4Result.value : [];
  const ipv6Addresses: string[] =
    v6Result.status === "fulfilled" ? v6Result.value : [];

  for (const ip of [...addresses, ...ipv6Addresses]) {
    if (isPrivateIP(ip)) {
      throw new ForbiddenError("Private IP addresses are not allowed");
    }
  }

  // If no addresses resolved, distinguish "no records" from real errors
  if (addresses.length === 0 && ipv6Addresses.length === 0) {
    const v4Error = v4Result.status === "rejected" ? v4Result.reason : null;
    const v6Error = v6Result.status === "rejected" ? v6Result.reason : null;

    if (v4Error && !isDnsNotFound(v4Error)) {
      throw new ForbiddenError(
        `DNS resolution failed for ${hostname}: ${(v4Error as Error).message || v4Error}`,
      );
    }
    if (v6Error && !isDnsNotFound(v6Error)) {
      throw new ForbiddenError(
        `DNS resolution failed for ${hostname}: ${(v6Error as Error).message || v6Error}`,
      );
    }

    throw new ForbiddenError(
      `DNS resolution failed: no records found for ${hostname}`,
    );
  }

  return url;
}

export function isValidHexColor(color: string): boolean {
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(color);
}

export function sanitizeHexColor(color: string): string {
  const cleaned = color.replace(/^#/, "");
  if (!isValidHexColor(cleaned)) {
    throw new ValidationError(`Invalid hex color: ${color}`);
  }
  return cleaned;
}
