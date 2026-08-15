import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ipHash } from "@/lib/anon";

/**
 * Database-backed rate limiting.
 *
 * A shared Postgres table rather than an in-memory counter because serverless
 * instances don't share memory — an in-process map would reset on every cold
 * start and be trivially bypassed. It's not the fastest option, but these are
 * write endpoints that run a handful of times per user per year.
 */

export type Limit = { kind: string; max: number; windowMinutes: number };

export const LIMITS = {
  /**
   * Submitting a review. No identity to gate on — a moderator approving each
   * one is the actual safeguard — so this rate limit is what stands between a
   * bored person and a flooded queue.
   */
  reviewSubmit: { kind: "review-submit", max: 5, windowMinutes: 60 },
  /** Flagging reviews — abusable as a censorship tool, so kept tight. */
  flag: { kind: "flag", max: 10, windowMinutes: 60 },
  /**
   * Agreeing/disagreeing with reviews. The real "once per review" guarantee
   * is ReviewVote's unique (reviewId, ipHash) constraint — this just stops
   * one IP from voting across many *different* reviews in a burst.
   */
  vote: { kind: "vote", max: 60, windowMinutes: 60 },
  /**
   * Suggesting club edits and submitting new clubs. Same pattern as reviews:
   * no identity verification, a moderator is the gate, so the rate limit is
   * the only thing standing between a bored person and a flooded queue.
   * Generous enough that someone fixing several stale links in one sitting
   * isn't blocked.
   */
  suggestEdit: { kind: "suggest-edit", max: 12, windowMinutes: 60 },
  submitClub: { kind: "submit-club", max: 5, windowMinutes: 180 },
  /** Bug reports / suggestions via the footer form. */
  feedback: { kind: "feedback", max: 10, windowMinutes: 60 },
} satisfies Record<string, Limit>;

/**
 * Best-effort client IP. Behind a proxy the leftmost x-forwarded-for entry is
 * the client; locally there's no header at all, so we fall back to a constant —
 * which is fine, because it just means one shared bucket in development.
 */
export async function clientIpHash(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    store.get("x-real-ip") ||
    store.get("cf-connecting-ip") ||
    "local";
  return ipHash(ip);
}

/**
 * Records an attempt and reports whether the caller is over the limit.
 * Recording first means a rejected attempt still counts, so hammering the
 * endpoint doesn't reset the window.
 */
export async function checkRateLimit(
  limit: Limit,
  hashedIp?: string,
): Promise<{ ok: boolean; retryAfterMinutes: number }> {
  const hash = hashedIp ?? (await clientIpHash());
  const since = new Date(Date.now() - limit.windowMinutes * 60_000);

  await prisma.submissionAttempt.create({
    data: { ipHash: hash, kind: limit.kind },
  });

  const count = await prisma.submissionAttempt.count({
    where: { ipHash: hash, kind: limit.kind, createdAt: { gte: since } },
  });

  // Opportunistic cleanup so the table doesn't grow forever. Cheap, indexed,
  // and there's no cron in this app to do it properly.
  if (count % 25 === 0) {
    await prisma.submissionAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
  }

  return {
    ok: count <= limit.max,
    retryAfterMinutes: limit.windowMinutes,
  };
}
