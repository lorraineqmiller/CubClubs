"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SORT_OPTIONS, type SortKey } from "@/lib/club-sort";

type Facet = {
  slug: string;
  label: string;
  count: number;
};

/**
 * Filters are URL state, not component state — every combination is a
 * shareable, bookmarkable link and the back button behaves.
 */
export function ClubFilters({
  categories,
  interests,
  tags,
  activeCategory,
  activeTag,
  sort,
  reviewedOnly,
}: {
  categories: Facet[];
  interests: Facet[];
  tags: Facet[];
  activeCategory?: string;
  activeTag?: string;
  sort: SortKey;
  reviewedOnly: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  /** Build a URL with one param changed, always resetting pagination. */
  function withParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    const query = next.toString();
    return query ? `/clubs?${query}` : "/clubs";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="sort" className="text-sm text-muted">
          Sort by
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(event) => router.push(withParam("sort", event.target.value))}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={reviewedOnly}
            onChange={(event) =>
              router.push(withParam("reviewed", event.target.checked ? "1" : null))
            }
            className="size-4 rounded border-line-strong accent-[var(--accent)]"
          />
          Only show clubs with reviews
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
          Category
        </legend>
        <ul className="flex flex-wrap gap-1.5">
          <li>
            <Link
              href={withParam("category", null)}
              className={chipClass(!activeCategory)}
              aria-current={!activeCategory ? "true" : undefined}
            >
              All
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <CategoryChip
                facet={category}
                active={activeCategory === category.slug}
                href={withParam(
                  "category",
                  activeCategory === category.slug ? null : category.slug,
                )}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {interests.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            Interest area{" "}
          </legend>
          <ul className="flex flex-wrap gap-1.5">
            {interests.map((interest) => (
              <li key={interest.slug}>
                <CategoryChip
                  facet={interest}
                  active={activeCategory === interest.slug}
                  href={withParam(
                    "category",
                    activeCategory === interest.slug ? null : interest.slug,
                  )}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {tags.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            Tag
          </legend>
          <ul className="flex flex-wrap gap-1.5">
            {activeTag && (
              <li>
                <Link href={withParam("tag", null)} className={chipClass(false)}>
                  Clear tag
                </Link>
              </li>
            )}
            {tags.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={withParam("tag", activeTag === tag.slug ? null : tag.slug)}
                  className={chipClass(activeTag === tag.slug)}
                  aria-current={activeTag === tag.slug ? "true" : undefined}
                >
                  {tag.label}
                  <span className="tnum ml-1.5 text-sm opacity-60">
                    {tag.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  );
}

function CategoryChip({
  facet,
  active,
  href,
}: {
  facet: Facet;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={chipClass(active)}
      aria-current={active ? "true" : undefined}
    >
      <CategoryIcon slug={facet.slug} className="mr-1.5" />
      {facet.label}
      <span className="tnum ml-1.5 text-sm opacity-60">{facet.count}</span>
    </Link>
  );
}

function chipClass(active: boolean) {
  return [
    "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors",
    active
      ? "border-accent bg-accent text-on-accent"
      : "border-line bg-surface text-muted hover:border-accent-ring hover:text-accent",
  ].join(" ");
}
