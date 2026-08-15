"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  submitNewClub,
  type SubmissionFormState,
} from "@/app/contribute/actions";
import {
  CategoryPicker,
  ContactBlock,
  TextAreaField,
  TextField,
  type CategoryOption,
} from "@/components/ContributeFields";

export function NewClubForm({
  categoryOptions,
}: {
  categoryOptions: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<
    SubmissionFormState,
    FormData
  >(submitNewClub, { ok: false });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Submission sent</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {/* Space inside the expression: JSX drops whitespace between an
              expression and a text run that wraps to the next line. */}
          Thank you. A moderator will check that {`${name || "the club"} `}is
          real and active before it appears. Once it does, it will look and
          work just like any other club on the site.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/clubs"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Browse clubs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.message}
        </p>
      )}

      <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextField
          id="name"
          label="Club name"
          value={name}
          onChange={setName}
          error={state.errors?.name}
          placeholder="Columbia Whatever Society"
        />
        <TextAreaField
          id="description"
          label="What is it?"
          hint="What the club does, roughly when it started, and how someone joins."
          value={description}
          onChange={setDescription}
          error={state.errors?.description}
          rows={6}
        />
        <TextField
          id="websiteUrl"
          label="Website or signup link (optional)"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          error={state.errors?.websiteUrl}
          placeholder="https://…"
        />
        <TextField
          id="contactEmail"
          type="email"
          label="Club contact email (optional)"
          hint="The club's inbox, not a personal address."
          value={contactEmail}
          onChange={setContactEmail}
          error={state.errors?.contactEmail}
        />
        <TextAreaField
          id="socialLinks"
          label="Social links (optional)"
          hint="One URL per line."
          value={socialLinks}
          onChange={setSocialLinks}
          error={state.errors?.socialLinks}
          rows={3}
          placeholder={"https://instagram.com/…"}
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <CategoryPicker
          options={categoryOptions}
          selected={categories}
          error={state.errors?.categories}
          onToggle={(slug) =>
            setCategories((current) =>
              current.includes(slug)
                ? current.filter((value) => value !== slug)
                : [...current, slug],
            )
          }
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <TextAreaField
          id="note"
          label="Anything else? (optional)"
          hint="Are you involved in the club? Roughly how many members? Anything that helps a moderator verify it."
          value={note}
          onChange={setNote}
          error={state.errors?.note}
          rows={3}
        />
      </div>

      <ContactBlock
        submitterEmail={submitterEmail}
        onChange={setSubmitterEmail}
        error={state.errors?.submitterEmail}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit club"}
        </button>
        <Link href="/clubs" className="text-sm text-muted hover:text-accent">
          Cancel
        </Link>
      </div>
    </form>
  );
}
