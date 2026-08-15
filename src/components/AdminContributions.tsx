"use client";

import { useState, useTransition } from "react";
import { reviewClubEdit, reviewClubSubmission } from "@/app/admin/actions";

/** One before/after row. Only rendered for fields the suggestion changed. */
function DiffRow({
  label,
  before,
  after,
}: {
  label: string;
  before: string | null;
  after: string | null;
}) {
  return (
    <div className="grid gap-1 border-t border-line py-2.5 sm:grid-cols-[7rem_1fr]">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="space-y-1 text-sm">
        <p className="text-faint line-through decoration-danger/40">
          {before || <span className="italic">empty</span>}
        </p>
        <p className="text-text">
          {after || <span className="italic text-faint">cleared</span>}
        </p>
      </div>
    </div>
  );
}

export type EditSuggestionItem = {
  id: string;
  createdAt: Date;
  note: string | null;
  submitterEmail: string | null;
  name: string | null;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  socialLinks: string[];
  categorySlugs: string[];
  club: {
    name: string;
    slug: string;
    description: string | null;
    websiteUrl: string | null;
    contactEmail: string | null;
    socialLinks: string[];
    categoryNames: string[];
  };
  /** Display names for the proposed category slugs, resolved server-side. */
  proposedCategoryNames: string[];
};

export function ActionBar({
  onDecide,
  pending,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: {
  onDecide: (action: "approve" | "reject", note?: string) => void;
  pending: boolean;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-3.5">
      {showNote && (
        <div>
          <label className="text-xs font-medium">
            Note to self (optional, not sent to the submitter)
          </label>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide("approve", note || undefined)}
          className="rounded-lg border border-positive/50 px-3 py-1.5 text-xs text-positive hover:bg-positive/10 disabled:opacity-60"
        >
          {approveLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide("reject", note || undefined)}
          className="rounded-lg border border-danger/50 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          {rejectLabel}
        </button>
        {!showNote && (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-xs text-faint hover:text-accent"
          >
            Add note
          </button>
        )}
      </div>
    </div>
  );
}

export function EditSuggestionCard({ item }: { item: EditSuggestionItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-semibold">{item.club.name}</h3>
        <a
          href={`/clubs/${item.club.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:text-accent"
        >
          View club ↗
        </a>
      </header>

      {item.note && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm leading-relaxed">
          <span className="text-faint">Submitter says: </span>
          {item.note}
        </p>
      )}

      <div className="mt-4">
        {item.name !== null && (
          <DiffRow label="Name" before={item.club.name} after={item.name} />
        )}
        {item.description !== null && (
          <DiffRow
            label="Description"
            before={item.club.description}
            after={item.description}
          />
        )}
        {item.websiteUrl !== null && (
          <DiffRow
            label="Website"
            before={item.club.websiteUrl}
            after={item.websiteUrl}
          />
        )}
        {item.contactEmail !== null && (
          <DiffRow
            label="Contact"
            before={item.club.contactEmail}
            after={item.contactEmail}
          />
        )}
        {item.socialLinks.length > 0 && (
          <DiffRow
            label="Social"
            before={item.club.socialLinks.join(", ")}
            after={item.socialLinks.join(", ")}
          />
        )}
        {item.categorySlugs.length > 0 && (
          <DiffRow
            label="Categories"
            before={item.club.categoryNames.join(", ")}
            after={item.proposedCategoryNames.join(", ")}
          />
        )}
      </div>

      {item.submitterEmail && (
        <p className="mt-3 text-xs text-faint">
          Contact: <span className="optical-reset font-mono">{item.submitterEmail}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <ActionBar
        pending={pending}
        approveLabel="Approve &amp; apply"
        onDecide={(action, note) =>
          startTransition(async () => {
            const result = await reviewClubEdit(item.id, action, note);
            if (!result.ok) setError(result.message ?? "Something went wrong.");
          })
        }
      />
    </article>
  );
}

export type ClubSubmissionItem = {
  id: string;
  createdAt: Date;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  socialLinks: string[];
  note: string | null;
  submitterEmail: string | null;
  categoryNames: string[];
};

export function ClubSubmissionCard({ item }: { item: ClubSubmissionItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-semibold">{item.name}</h3>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
          new club
        </span>
      </header>

      {item.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
          {item.description}
        </p>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-xs text-faint">Categories</dt>
          <dd>{item.categoryNames.join(", ") || "—"}</dd>
        </div>
        {item.websiteUrl && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs text-faint">Website</dt>
            <dd className="min-w-0 break-all">
              <a
                href={item.websiteUrl}
                target="_blank"
                rel="noreferrer nofollow"
                className="text-accent hover:underline"
              >
                {item.websiteUrl}
              </a>
            </dd>
          </div>
        )}
        {item.contactEmail && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs text-faint">Club email</dt>
            <dd className="font-mono text-[22px]">
              <span className="optical-reset">{item.contactEmail}</span>
            </dd>
          </div>
        )}
        {item.socialLinks.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs text-faint">Social</dt>
            <dd className="min-w-0 space-y-0.5">
              {item.socialLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="block break-all text-accent hover:underline"
                >
                  {url}
                </a>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {item.note && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm leading-relaxed">
          <span className="text-faint">Submitter says: </span>
          {item.note}
        </p>
      )}

      {item.submitterEmail && (
        <p className="mt-3 text-xs text-faint">
          Contact: <span className="optical-reset font-mono">{item.submitterEmail}</span>
        </p>
      )}

      <p className="mt-3 text-xs text-caution">
        Check it actually exists before approving — the social links are usually
        the fastest way.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <ActionBar
        pending={pending}
        approveLabel="Approve &amp; create"
        onDecide={(action, note) =>
          startTransition(async () => {
            const result = await reviewClubSubmission(item.id, action, note);
            if (!result.ok) setError(result.message ?? "Something went wrong.");
          })
        }
      />
    </article>
  );
}
