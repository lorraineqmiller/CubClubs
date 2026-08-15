"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  suggestClubEdit,
  type SubmissionFormState,
} from "@/app/contribute/actions";
import {
  CategoryPicker,
  ContactBlock,
  TextAreaField,
  TextField,
  type CategoryOption,
} from "@/components/ContributeFields";

export type ClubCurrentValues = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  socialLinks: string[];
  categorySlugs: string[];
};

/**
 * Prefilled with the club's current values, so suggesting an edit means editing
 * what's there rather than describing a change in prose. The action compares
 * against the stored values and keeps only what actually differs.
 */
export function SuggestEditForm({
  club,
  categoryOptions,
}: {
  club: ClubCurrentValues;
  categoryOptions: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<
    SubmissionFormState,
    FormData
  >(suggestClubEdit, { ok: false });

  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(club.websiteUrl ?? "");
  const [contactEmail, setContactEmail] = useState(club.contactEmail ?? "");
  const [socialLinks, setSocialLinks] = useState(club.socialLinks.join("\n"));
  const [categories, setCategories] = useState<string[]>(club.categorySlugs);
  const [note, setNote] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Suggestion sent
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Thank you — a moderator will look at it. Nothing changes on{" "}
          {club.name} until someone approves it, and approved corrections stick
          even when we re-import the directory.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/clubs/${club.slug}`}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Back to {club.name}
          </Link>
          <Link
            href="/clubs"
            className="rounded-lg border border-line px-4 py-2.5 text-sm hover:border-accent-ring hover:text-accent"
          >
            Browse clubs
          </Link>
        </div>
      </div>
    );
  }

  const categoriesChanged =
    categories.length !== club.categorySlugs.length ||
    [...categories].sort().join("|") !== [...club.categorySlugs].sort().join("|");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="clubId" value={club.id} />

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
          label="Name"
          value={name}
          onChange={setName}
          original={club.name}
          error={state.errors?.name}
        />
        <TextAreaField
          id="description"
          label="Description"
          hint="What the club is and does. Plain description, not a pitch."
          value={description}
          onChange={setDescription}
          original={club.description}
          error={state.errors?.description}
          rows={6}
        />
        <TextField
          id="websiteUrl"
          label="Website"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          original={club.websiteUrl}
          error={state.errors?.websiteUrl}
          placeholder="https://…"
        />
        <TextField
          id="contactEmail"
          type="email"
          label="Contact email"
          hint="The club's own inbox, not yours."
          value={contactEmail}
          onChange={setContactEmail}
          original={club.contactEmail}
          error={state.errors?.contactEmail}
        />
        <TextAreaField
          id="socialLinks"
          label="Social links"
          hint="One URL per line."
          value={socialLinks}
          onChange={setSocialLinks}
          original={club.socialLinks.join("\n")}
          error={state.errors?.socialLinks}
          rows={3}
          placeholder={"https://instagram.com/…\nhttps://facebook.com/…"}
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <CategoryPicker
          options={categoryOptions}
          selected={categories}
          changed={categoriesChanged}
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
          label="Anything the moderator should know? (optional)"
          hint="Why the change is right is often the deciding factor — “they moved to a new site in September”, “this merged with X last spring”."
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
          {pending ? "Sending…" : "Send suggestion"}
        </button>
        <Link
          href={`/clubs/${club.slug}`}
          className="text-sm text-muted hover:text-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
