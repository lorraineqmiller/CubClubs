"use client";

import { CategoryIcon } from "@/components/CategoryIcon";

/**
 * Field primitives shared by the suggest-edit and add-a-club forms.
 *
 * All controlled, for the same reason the review form is: React 19 resets a
 * form once its action returns — including on failure — so an uncontrolled field
 * empties itself the moment validation fails and the submitter has to retype it.
 */

/**
 * Inputs are filled with `surface-2`, not the page background. They sit inside
 * white cards and want to look slightly recessed — tying them to `--bg` meant
 * they turned baby blue when the page background did, which reads as a disabled
 * field rather than an editable one.
 */
const fieldClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  original,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  /** Current stored value, shown when the field has been changed. */
  original?: string | null;
}) {
  const changed = original !== undefined && value.trim() !== (original ?? "");
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {changed && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[19px] font-normal text-accent">
            changed
          </span>
        )}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  rows = 5,
  placeholder,
  original,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows?: number;
  placeholder?: string;
  original?: string | null;
}) {
  const changed = original !== undefined && value.trim() !== (original ?? "");
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {changed && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[19px] font-normal text-accent">
            changed
          </span>
        )}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} leading-relaxed`}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type CategoryOption = {
  slug: string;
  name: string;
  kind: "SOURCE" | "INTEREST";
};

/**
 * Category picker. Toggle buttons plus hidden inputs rather than checkboxes —
 * same form-reset desync that made the review form lose its ratings.
 */
export function CategoryPicker({
  options,
  selected,
  onToggle,
  error,
  changed,
}: {
  options: CategoryOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  error?: string;
  changed?: boolean;
}) {
  const groups: Array<{ heading: string; blurb: string; items: CategoryOption[] }> = [
    {
      heading: "Columbia's categories",
      blurb: "Pick the one that fits best.",
      items: options.filter((option) => option.kind === "SOURCE"),
    },
    {
      heading: "Interest areas",
      blurb: "Optional. Add any that apply.",
      items: options.filter((option) => option.kind === "INTEREST"),
    },
  ];

  return (
    <div>
      <p className="text-sm font-medium">
        Categories
        {changed && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[19px] font-normal text-accent">
            changed
          </span>
        )}
      </p>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">
              {group.heading}{" "}
              <span className="font-normal normal-case tracking-normal">
                — {group.blurb}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.items.map((option) => {
                const active = selected.includes(option.slug);
                return (
                  <button
                    key={option.slug}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => onToggle(option.slug)}
                    className={[
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line text-muted hover:border-accent-ring hover:text-accent",
                    ].join(" ")}
                  >
                    <CategoryIcon slug={option.slug} />
                    {option.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected.map((slug) => (
        <input key={slug} type="hidden" name="categories" value={slug} />
      ))}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactBlock({
  submitterEmail,
  onChange,
  error,
}: {
  submitterEmail: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <TextField
        id="submitterEmail"
        type="email"
        label="Your email (optional)"
        hint="Only so a moderator can ask a follow-up question. Not published, and not used for anything else. Unlike a review, this one is stored as you typed it — replying is the whole point."
        value={submitterEmail}
        onChange={onChange}
        error={error}
        placeholder="you@columbia.edu"
      />
    </div>
  );
}
