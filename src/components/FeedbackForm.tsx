"use client";

import { useActionState, useEffect, useState } from "react";
import { submitFeedback, type FeedbackFormState } from "@/app/feedback/actions";

const KINDS: Array<{ value: "BUG" | "SUGGESTION"; label: string }> = [
  { value: "BUG", label: "I found a bug" },
  { value: "SUGGESTION", label: "I have a suggestion" },
];

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState<
    FeedbackFormState,
    FormData
  >(submitFeedback, { ok: false });
  const [kind, setKind] = useState<"BUG" | "SUGGESTION">("BUG");
  const [message, setMessage] = useState("");
  // Best-effort context for a bug report — where they were when they hit it —
  // not load-bearing, so it's fine if this stays empty (no referrer, or the
  // visitor came in directly).
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => {
    setPageUrl(document.referrer);
  }, []);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Thanks!</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A moderator reads every submission. If you left a way to reach you,
          we might follow up.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="pageUrl" value={pageUrl} />

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.message}
        </p>
      )}

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">What's this about?</p>
        <input type="hidden" name="kind" value={kind} />
        <div role="radiogroup" className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((option) => {
            const active = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(option.value)}
                className={[
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "cursor-pointer border-line text-muted hover:border-accent-ring hover:text-accent",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <label htmlFor="message" className="text-sm font-semibold">
          Tell us more
        </label>
        <p className="mt-1 text-sm text-muted">
          What happened, or what would you change? Specifics help (which page you found the bug, etc.)
        </p>
        <textarea
          id="message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          required
          minLength={10}
          maxLength={2000}
          className="mt-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[26px] leading-relaxed"
        />
        <p className="mt-2 text-right text-xs text-faint">
          {message.length}/2000
        </p>
        {state.errors?.message && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {state.errors.message}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <label htmlFor="contactEmail" className="text-sm font-semibold">
          Your email <span className="font-normal text-faint">(optional)</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          If you would like a follow-up
        </p>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          autoComplete="email"
          className="mt-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[22px]"
        />
        {state.errors?.contactEmail && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {state.errors.contactEmail}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
