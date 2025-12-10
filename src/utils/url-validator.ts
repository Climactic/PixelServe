import dns from "node:dns/promises";
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

  // DNS resolution check to prevent SSRF via DNS rebinding
  try {
    // Try IPv4 first
    const addresses = await dns.resolve4(hostname).catch(() => []);

    for (const ip of addresses) {
      if (isPrivateIP(ip)) {
        throw new ForbiddenError("Private IP addresses are not allowed");
      }
    }

    // Also check IPv6 if available
    const ipv6Addresses = await dns.resolve6(hostname).catch(() => []);

    for (const ip of ipv6Addresses) {
      if (isPrivateIP(ip)) {
        throw new ForbiddenError("Private IP addresses are not allowed");
      }
    }

    // If no addresses resolved at all, that's suspicious
    if (addresses.length === 0 && ipv6Addresses.length === 0) {
      // Could be a hosts file entry or local resolver - allow but log
      console.warn(`No DNS records found for ${hostname}`);
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error;
    }
    // DNS resolution failed - might be temporary, allow but log
    console.warn(`DNS resolution warning for ${hostname}:`, error);
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
