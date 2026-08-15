import { cookies } from "next/headers";
import { safeEqual } from "@/lib/anon";

/**
 * Moderator access is a single shared bearer token in ADMIN_TOKEN, exchanged for
 * an httpOnly cookie.
 *
 * That's deliberately minimal — one or two people moderate this site, and real
 * accounts would mean storing moderator identities and passwords for no gain.
 * The trade-off is no audit trail of *which* moderator acted; if the moderation
 * team ever grows past a couple of people, this is the thing to replace.
 */
export const ADMIN_COOKIE = "cubclubs_admin";

function expectedToken(): string | null {
  const token = process.env.ADMIN_TOKEN;
  // An unset or placeholder token must not grant access.
  if (!token || token.length < 16 || token.startsWith("change-me")) return null;
  return token;
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const provided = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!provided) return false;
  return safeEqual(provided, expected);
}

/** Whether admin access is configured at all, so the UI can explain itself. */
export function isAdminConfigured(): boolean {
  return expectedToken() !== null;
}

export function checkAdminToken(candidate: string): boolean {
  const expected = expectedToken();
  if (!expected) return false;
  return safeEqual(candidate, expected);
}
