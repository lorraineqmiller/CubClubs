/**
 * Identity handling for anonymous actions. Server-only — imports node:crypto.
 *
 * Reviews carry no identity at all: no email, no account. The only actor
 * identity in the system is a hashed IP, used solely for rate limiting.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.REVIEW_HMAC_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "REVIEW_HMAC_SECRET is missing or too short. Generate one with " +
        "`openssl rand -hex 32` and set it in .env.",
    );
  }
  return value;
}

/**
 * Domain-separated HMAC. `purpose` stops a hash produced for one context from
 * being meaningful in another.
 */
function hmac(purpose: string, ...parts: string[]): string {
  return createHmac("sha256", secret())
    .update(purpose)
    .update(" ")
    .update(parts.join(" "))
    .digest("hex");
}

/** Coarse actor identity for rate limiting. Never stored in the clear. */
export function ipHash(ip: string): string {
  return hmac("ip", ip);
}

/** Constant-time compare, for admin bearer tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
