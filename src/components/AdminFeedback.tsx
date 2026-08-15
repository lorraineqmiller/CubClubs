"use client";

import { useState, useTransition } from "react";
import { reviewFeedback } from "@/app/admin/actions";
import { ActionBar } from "@/components/AdminContributions";

export type FeedbackItem = {
  id: string;
  kind: "BUG" | "SUGGESTION";
  message: string;
  contactEmail: string | null;
  pageUrl: string | null;
  createdAt: Date;
};

export function FeedbackCard({ item }: { item: FeedbackItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs",
            item.kind === "BUG"
              ? "bg-danger/10 text-danger"
              : "bg-accent-soft text-accent",
          ].join(" ")}
        >
          {item.kind === "BUG" ? "Bug report" : "Suggestion"}
        </span>
        {item.pageUrl && (
          <a
            href={item.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="max-w-full truncate text-xs text-muted hover:text-accent"
          >
            {item.pageUrl} ↗
          </a>
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
        {item.message}
      </p>

      {item.contactEmail && (
        <p className="mt-3 text-xs text-faint">
          Contact: <span className="optical-reset font-mono">{item.contactEmail}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <ActionBar
        pending={pending}
        approveLabel="Mark resolved"
        rejectLabel="Dismiss"
        onDecide={(action, note) =>
          startTransition(async () => {
            const result = await reviewFeedback(item.id, action, note);
            if (!result.ok) setError(result.message ?? "Something went wrong.");
          })
        }
      />
    </article>
  );
}
