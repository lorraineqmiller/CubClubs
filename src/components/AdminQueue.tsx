"use client";

import { useActionState, useTransition } from "react";
import { adminLogin, adminLogout, moderateReview } from "@/app/admin/actions";
import { FLAG_REASON_LABELS } from "@/lib/ratings";

export function AdminLogin() {
  const [state, action, pending] = useActionState(adminLogin, {});
  return (
    <form action={action} className="max-w-sm space-y-3">
      <div>
        <label htmlFor="token" className="text-sm font-medium">
          Admin token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          required
          autoComplete="off"
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export function AdminToolbar() {
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => startTransition(() => void adminLogout())}
        className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-accent-ring"
      >
        Sign out
      </button>
    </div>
  );
}

export type QueueItem = {
  id: string;
  body: string;
  flagCount: number;
  status: string;
  createdAt: Date;
  club: { name: string; slug: string };
  flags: Array<{ id: string; reason: string; note: string | null; createdAt: Date }>;
};

/**
 * "flagged" (default): a previously-published review a community report
 * hid, or that's still up but has open reports — approving keeps it live,
 * rejecting takes it down.
 * "pending": a brand-new submission awaiting its first moderator decision —
 * approving publishes it for the first time, rejecting just discards it (see
 * moderateReview's doc comment for why those two cases differ).
 */
export function QueueCard({
  review,
  mode = "flagged",
}: {
  review: QueueItem;
  mode?: "flagged" | "pending";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-semibold">{review.club.name}</h3>
        {mode === "flagged" && (
          <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs text-danger">
            {review.flagCount} report{review.flagCount === 1 ? "" : "s"}
          </span>
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
        {review.body}
      </p>

      {review.flags.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-3">
          {review.flags.map((flag) => (
            <li key={flag.id} className="text-xs">
              <span className="font-medium">
                {FLAG_REASON_LABELS[flag.reason] ?? flag.reason}
              </span>
              {flag.note && <span className="text-muted"> — “{flag.note}”</span>}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void moderateReview(review.id, "approve"))
          }
          className="rounded-lg border border-positive/50 px-3 py-1.5 text-xs text-positive hover:bg-positive/10 disabled:opacity-60"
        >
          {mode === "pending" ? "Approve" : "Keep it up"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void moderateReview(review.id, "reject"))
          }
          className="rounded-lg border border-danger/50 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          {mode === "pending" ? "Reject" : "Remove it"}
        </button>
        <a
          href={`/clubs/${review.club.slug}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto self-center text-xs text-muted hover:text-accent"
        >
          View club ↗
        </a>
      </footer>
    </article>
  );
}
