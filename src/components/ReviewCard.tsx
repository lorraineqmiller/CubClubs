"use client";

import { useActionState, useState, useTransition } from "react";
import { flagReview, voteOnReview } from "@/app/actions";
import { RatingPips } from "@/components/RatingBar";
import {
  AFFILIATION_LABELS,
  FLAG_REASON_LABELS,
  HOW_TO_JOIN_LABEL_BY_SLUG,
  ROLE_LABELS,
} from "@/lib/ratings";

export type ReviewData = {
  id: string;
  displayId: number;
  body: string;
  ratingProfessional: number;
  ratingSocial: number;
  ratingCommitment: number;
  ratingOrganization: number;
  ratingRecommend: number;
  howToJoin: string[];
  howToJoinOther: string | null;
  affiliation: string | null;
  role: string | null;
  yearInvolved: number | null;
  agreeCount: number;
  disagreeCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  /** The current visitor's own vote, looked up server-side by IP — see
   *  getClubReviews — so the button reflects reality on first render, not
   *  just after a click this session. */
  myVote: "AGREE" | "DISAGREE" | null;
  tags: Array<{ tag: { label: string; slug: string } }>;
};

/** The date shown is submission date, not publish date — see `createdAt`
 *  below — and includes the day, not just month/year, since it doubles as
 *  the review's timestamp next to its id. */
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ReviewCard({
  review,
  clubSlug,
}: {
  review: ReviewData;
  clubSlug: string;
}) {
  const [agreeCount, setAgreeCount] = useState(review.agreeCount);
  const [disagreeCount, setDisagreeCount] = useState(review.disagreeCount);
  const [myVote, setMyVote] = useState(review.myVote);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voting, startVoteTransition] = useTransition();
  const [showFlag, setShowFlag] = useState(false);
  const [flagState, flagAction, flagPending] = useActionState(flagReview, {
    ok: false,
  });

  function vote(value: "AGREE" | "DISAGREE") {
    if (myVote || voting) return;
    startVoteTransition(async () => {
      setVoteError(null);
      setMyVote(value);
      if (value === "AGREE") setAgreeCount((count) => count + 1);
      else setDisagreeCount((count) => count + 1);

      const result = await voteOnReview(review.id, clubSlug, value);
      if (!result.ok) {
        setMyVote(null);
        if (value === "AGREE") setAgreeCount((count) => count - 1);
        else setDisagreeCount((count) => count - 1);
        setVoteError(result.message ?? "Couldn't record that vote.");
      }
    });
  }

  // Byline pieces are all optional, so build the list then join what's there.
  const byline = [
    review.role ? ROLE_LABELS[review.role] : null,
    review.affiliation ? AFFILIATION_LABELS[review.affiliation] : null,
    review.yearInvolved ? `involved ${review.yearInvolved}` : null,
  ].filter(Boolean);

  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-sm font-medium">Anonymous</p>
          {byline.length > 0 && (
            <p className="mt-0.5 text-xs text-muted">{byline.join(" · ")}</p>
          )}
        </div>
        <p className="tnum text-xs text-faint">
          #{review.displayId} · {formatDate(review.createdAt)}
        </p>
      </header>

      <p className="mt-4 whitespace-pre-line text-[26px] leading-relaxed">
        {review.body}
      </p>

      {review.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {review.tags.map(({ tag }) => (
            <li
              key={tag.slug}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-[19px] text-muted"
            >
              {tag.label}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
        <RatingPips dimension="professional" value={review.ratingProfessional} />
        <RatingPips dimension="community" value={review.ratingSocial} />
        <RatingPips dimension="organization" value={review.ratingOrganization} />
        <RatingPips dimension="commitment" value={review.ratingCommitment} />
        <RatingPips dimension="recommend" value={review.ratingRecommend} />
      </dl>

      <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        <p>
          <span className="text-muted">How they got in: </span>
          {review.howToJoin
            .map((slug) =>
              slug === "other" && review.howToJoinOther
                ? `Other (${review.howToJoinOther})`
                : (HOW_TO_JOIN_LABEL_BY_SLUG[slug] ?? slug),
            )
            .join(", ")}
        </p>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3.5">
        <button
          type="button"
          disabled={!!myVote || voting}
          onClick={() => vote("AGREE")}
          className={[
            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60",
            myVote === "AGREE"
              ? "border-accent bg-accent-soft text-accent"
              : "border-line text-muted hover:border-accent-ring hover:text-accent",
          ].join(" ")}
        >
          Agree
          {agreeCount > 0 && <span className="tnum ml-1.5">{agreeCount}</span>}
        </button>
        <button
          type="button"
          disabled={!!myVote || voting}
          onClick={() => vote("DISAGREE")}
          className={[
            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60",
            myVote === "DISAGREE"
              ? "border-danger/50 bg-danger/10 text-danger"
              : "border-line text-muted hover:border-accent-ring hover:text-accent",
          ].join(" ")}
        >
          Disagree
          {disagreeCount > 0 && <span className="tnum ml-1.5">{disagreeCount}</span>}
        </button>

        {!showFlag && !flagState.ok && (
          <button
            type="button"
            onClick={() => setShowFlag(true)}
            className="text-xs text-faint hover:text-danger"
          >
            Report
          </button>
        )}

        {flagState.ok && (
          <p className="text-xs text-positive">{flagState.message}</p>
        )}
      </footer>

      {voteError && <p className="mt-2 text-xs text-danger">{voteError}</p>}

      {showFlag && !flagState.ok && (
        <form
          action={flagAction}
          className="mt-3 space-y-3 rounded-lg bg-surface-2 p-3.5"
        >
          <input type="hidden" name="reviewId" value={review.id} />
          <input type="hidden" name="clubSlug" value={clubSlug} />
          <div>
            <label
              htmlFor={`reason-${review.id}`}
              className="text-xs font-medium"
            >
              Why are you reporting this?
            </label>
            <select
              id={`reason-${review.id}`}
              name="reason"
              required
              defaultValue=""
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
            >
              <option value="" disabled>
                Choose a reason…
              </option>
              {Object.entries(FLAG_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`note-${review.id}`} className="text-xs font-medium">
              Anything else? <span className="text-faint">(optional)</span>
            </label>
            <textarea
              id={`note-${review.id}`}
              name="note"
              rows={2}
              maxLength={500}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
            />
          </div>
          {flagState.message && !flagState.ok && (
            <p className="text-xs text-danger">{flagState.message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={flagPending}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
            >
              {flagPending ? "Sending…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setShowFlag(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
