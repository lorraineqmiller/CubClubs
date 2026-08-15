"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitReview, type ReviewFormState } from "@/app/actions";
import {
  AFFILIATION_LABELS,
  HOW_TO_JOIN_OPTIONS,
  HOW_TO_JOIN_OTHER_SLUG,
  MAX_BODY_LENGTH,
  MIN_BODY_LENGTH,
  RATING_DIMENSIONS,
  ROLE_LABELS,
} from "@/lib/ratings";

type TagGroup = {
  group: string;
  items: Array<{ slug: string; label: string; description: string | null }>;
};

const MAX_TAGS = 8;

/**
 * A scale rendered as a button radiogroup, with the value carried by a
 * hidden input. Works for any scale length — Organization is 3 points, the
 * rest are 5 (see RATING_DIMENSIONS) — rather than assuming 5.
 *
 * Not `<input type="radio">`, and that's deliberate. React 19 resets a form
 * after its action completes — including on failure — which unchecks the radios
 * in the DOM. React only rewrites `checked` when the prop *changes*, so the
 * prop still matching stale state means it never restores them: a failed
 * submission silently wiped all four ratings and the user couldn't tell why
 * resubmitting failed again. Buttons hold no resettable form state, and a
 * hidden input's `value` React does re-assert on every commit.
 *
 * Buttons rather than a slider because each value carries its own word — "3"
 * means nothing on its own, and a slider hides the vocabulary that makes these
 * ratings comparable across clubs.
 */
function RatingScale({
  name,
  label,
  prompt,
  scale,
  value,
  onChange,
  error,
  className,
}: {
  name: string;
  label: string;
  prompt: string;
  scale: readonly string[];
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  className?: string;
}) {
  const groupId = `${name}-label`;
  const max = scale.length;

  /** Arrow/Home/End navigation, which native radios would have given us free. */
  function handleKeyDown(event: React.KeyboardEvent) {
    const current = value ?? 0;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = current >= max ? 1 : current + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = current <= 1 ? max : current - 1;
    } else if (event.key === "Home") {
      next = 1;
    } else if (event.key === "End") {
      next = max;
    }
    if (next !== null) {
      event.preventDefault();
      onChange(next);
    }
  }

  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 ${className ?? ""}`}
    >
      <p id={groupId} className="text-sm font-semibold">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-muted">{prompt}</p>

      <input type="hidden" name={name} value={value ?? ""} />

      <div
        role="radiogroup"
        aria-labelledby={groupId}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        onKeyDown={handleKeyDown}
        className={`mt-3.5 grid gap-1.5 ${max === 3 ? "grid-cols-3" : "grid-cols-5"}`}
      >
        {scale.map((word, index) => {
          const step = index + 1;
          const active = value === step;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${step} — ${word}`}
              // Only the selected option (or the first, when nothing is chosen)
              // is tabbable, so the group is one stop rather than five.
              tabIndex={active || (value === null && step === 1) ? 0 : -1}
              onClick={() => onChange(step)}
              className={[
                "flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors",
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-accent-ring",
              ].join(" ")}
            >
              <span
                className={`tnum text-sm font-semibold ${
                  active ? "text-accent" : "text-text"
                }`}
              >
                {step}
              </span>
              <span
                className={`w-full break-words text-xs leading-tight text-balance ${
                  active ? "text-accent" : "text-faint"
                }`}
              >
                {word}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReviewForm({
  clubId,
  clubName,
  clubSlug,
  tagGroups,
}: {
  clubId: string;
  clubName: string;
  clubSlug: string;
  tagGroups: TagGroup[];
}) {
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(
    submitReview,
    { ok: false },
  );
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Ratings live here rather than inside each scale so a failed submission
  // (which re-renders this component) can't lose them.
  const [ratings, setRatings] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(RATING_DIMENSIONS.map((dim) => [dim.field, null])),
  );
  const [howToJoin, setHowToJoin] = useState<string[]>([]);
  const [howToJoinOther, setHowToJoinOther] = useState("");
  // Everything else is controlled for the same reason: React resets the form
  // once the action returns, so any field left uncontrolled empties itself the
  // moment validation fails and the user has to retype it.
  const [affiliation, setAffiliation] = useState("");
  const [role, setRole] = useState("");
  const [yearInvolved, setYearInvolved] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - i);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Submitted — awaiting approval
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A moderator reviews every submission before it goes live. Your
          review of {clubName}{" "}
          will appear on the club&apos;s page once it&apos;s approved.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/clubs/${clubSlug}`}
            className="rounded-lg border border-line px-4 py-2.5 text-sm hover:border-accent-ring hover:text-accent"
          >
            Back to {clubName}
          </Link>
          <Link
            href="/clubs"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Review another club
          </Link>
        </div>
      </div>
    );
  }

  const remaining = MIN_BODY_LENGTH - body.trim().length;
  const tagLimitReached = selectedTags.length >= MAX_TAGS;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="clubId" value={clubId} />

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.message}
        </p>
      )}

      {/* Ratings */}
      {/* Stacked full-width rather than a 2-column grid — at half width each
          of the 5 scale buttons was too narrow for words like "professionally"
          to fit on one line. */}
      <div className="grid gap-4">
        {RATING_DIMENSIONS.map((dim) => (
          <RatingScale
            key={dim.key}
            name={dim.field}
            label={dim.label}
            prompt={dim.prompt}
            scale={dim.scale}
            value={ratings[dim.field]}
            onChange={(value) =>
              setRatings((current) => ({ ...current, [dim.field]: value }))
            }
            error={state.errors?.[dim.field]}
          />
        ))}
      </div>

      {/* How to join */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">How did you get in?</p>
        <p className="mt-0.5 text-sm text-muted">
          Choose all that applied.
        </p>
        <div
          role="group"
          aria-invalid={state.errors?.howToJoin ? true : undefined}
          className="mt-3.5 flex flex-wrap gap-1.5"
        >
          {HOW_TO_JOIN_OPTIONS.map((option) => {
            const checked = howToJoin.includes(option.slug);
            return (
              <button
                key={option.slug}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  setHowToJoin((current) =>
                    current.includes(option.slug)
                      ? current.filter((slug) => slug !== option.slug)
                      : [...current, option.slug],
                  )
                }
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                  checked
                    ? "border-accent bg-accent text-on-accent"
                    : "cursor-pointer border-line text-muted hover:border-accent-ring hover:text-accent",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {/* Travels as hidden fields, read with formData.getAll("howToJoin"). */}
        {howToJoin.map((slug) => (
          <input key={slug} type="hidden" name="howToJoin" value={slug} />
        ))}
        {howToJoin.includes(HOW_TO_JOIN_OTHER_SLUG) && (
          <div className="mt-3">
            <label htmlFor="howToJoinOther" className="text-xs font-medium">
              How, exactly?
            </label>
            <input
              id="howToJoinOther"
              name="howToJoinOther"
              type="text"
              value={howToJoinOther}
              onChange={(event) => setHowToJoinOther(event.target.value)}
              maxLength={200}
              placeholder="e.g. referred by a friend already in the club"
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            />
            {state.errors?.howToJoinOther && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {state.errors.howToJoinOther}
              </p>
            )}
          </div>
        )}
        {state.errors?.howToJoin && (
          <p role="alert" className="mt-2.5 text-xs text-danger">
            {state.errors.howToJoin}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <label htmlFor="body" className="text-sm font-semibold">
          Your review
        </label>
        <p className="mt-1 text-sm text-muted">
          What would you tell a friend who was thinking about joining? Be as specific as possible.
          For example: what the time commitment actually was, what
          getting in involved, what you&apos;d have wanted to know.
        </p>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={9}
          required
          minLength={MIN_BODY_LENGTH}
          maxLength={MAX_BODY_LENGTH}
          aria-describedby="body-hint"
          className="mt-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[26px] leading-relaxed"
          placeholder="I joined sophomore year and…"
        />
        <div
          id="body-hint"
          className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs"
        >
          <span className={remaining > 0 ? "text-faint" : "text-positive"}>
            {remaining > 0
              ? `${remaining} more character${remaining === 1 ? "" : "s"} needed`
              : "Long enough"}
          </span>
          <span className="tnum text-faint">
            {body.length}/{MAX_BODY_LENGTH}
          </span>
        </div>
        {state.errors?.body && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {state.errors.body}
          </p>
        )}
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
          See the{" "}
          <Link href="/guidelines" className="text-accent underline">
            review guidelines
          </Link>
          .
        </p>
      </div>

      {/* Tags */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">
          Tags <span className="font-normal text-faint">(optional)</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Pick up to {MAX_TAGS}{" "}
          that fit. These become the labels other students filter by.
        </p>
        <div className="mt-4 space-y-4">
          {tagGroups.map((group) => (
            <fieldset key={group.group}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                {group.group}
              </legend>
              {/* Toggle buttons rather than checkboxes, for the same
                  form-reset reason as the rating scales above. */}
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((tag) => {
                  const checked = selectedTags.includes(tag.slug);
                  const disabled = !checked && tagLimitReached;
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={disabled}
                      title={tag.description ?? undefined}
                      onClick={() =>
                        setSelectedTags((current) =>
                          current.includes(tag.slug)
                            ? current.filter((slug) => slug !== tag.slug)
                            : [...current, tag.slug],
                        )
                      }
                      className={[
                        "inline-flex items-center rounded-full border px-3.5 py-2 text-sm transition-colors",
                        checked
                          ? "border-accent bg-accent text-on-accent"
                          : disabled
                            ? "cursor-not-allowed border-line text-faint opacity-50"
                            : "cursor-pointer border-line text-muted hover:border-accent-ring hover:text-accent",
                      ].join(" ")}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        {/* The chosen tags travel as hidden fields, which the server action
            reads with formData.getAll("tags"). */}
        {selectedTags.map((slug) => (
          <input key={slug} type="hidden" name="tags" value={slug} />
        ))}
        <p className="mt-3 text-xs text-faint">
          {selectedTags.length}/{MAX_TAGS} selected
        </p>
      </div>

      {/* Context */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">
          About you <span className="font-normal text-faint">(optional)</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Optionally shown on your review as context
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="affiliation" className="text-xs font-medium">
              School
            </label>
            <select
              id="affiliation"
              name="affiliation"
              value={affiliation}
              onChange={(event) => setAffiliation(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs"
            >
              <option value="">Prefer not to say</option>
              {Object.entries(AFFILIATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="role" className="text-xs font-medium">
              Your role
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs"
            >
              <option value="">Prefer not to say</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="yearInvolved" className="text-xs font-medium">
              Most recent year involved
            </label>
            <select
              id="yearInvolved"
              name="yearInvolved"
              value={yearInvolved}
              onChange={(event) => setYearInvolved(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs"
            >
              <option value="">Prefer not to say</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit review"}
        </button>
        <Link
          href={`/clubs/${clubSlug}`}
          className="text-sm text-muted hover:text-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
