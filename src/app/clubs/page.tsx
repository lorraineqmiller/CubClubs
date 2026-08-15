import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ClubCard } from "@/components/ClubCard";
import { ClubFilters } from "@/components/ClubFilters";
import { parseSort } from "@/lib/club-sort";
import {
  getCategoriesWithCounts,
  getTagsWithCounts,
  listClubs,
} from "@/lib/clubs";

export const metadata: Metadata = {
  title: "Browse clubs",
  description:
    "Every student organization we track, filterable by category, tag, and rating.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const category = first(params.category);
  const tag = first(params.tag);
  const reviewedOnly = first(params.reviewed) === "1";
  const rawSort = first(params.sort);
  // An unknown sort in the URL falls back to A–Z rather than erroring.
  const sort = parseSort(rawSort);
  const page = Number(first(params.page) ?? 1) || 1;

  const [result, categories, tags] = await Promise.all([
    listClubs({ q, category, tag, sort, page, reviewedOnly }),
    getCategoriesWithCounts(),
    getTagsWithCounts(),
  ]);

  const activeCategory = categories.find((c) => c.slug === category);
  const activeTag = tags.find((t) => t.slug === tag);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    if (tag) next.set("tag", tag);
    if (reviewedOnly) next.set("reviewed", "1");
    if (rawSort) next.set("sort", sort);
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return query ? `/clubs?${query}` : "/clubs";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
          {activeCategory ? (
            <>
              <CategoryIcon slug={activeCategory.slug} size={26} />
              {activeCategory.name}
            </>
          ) : activeTag ? (
            `Tagged “${activeTag.label}”`
          ) : (
            "All clubs"
          )}
        </h1>
        <p className="text-sm text-muted">
          {q ? (
            <>
              <span className="tnum font-medium text-text">{result.total}</span>{" "}
              {result.total === 1 ? "club matches" : "clubs match"} “{q}”
            </>
          ) : (
            <>
              <span className="tnum font-medium text-text">{result.total}</span>{" "}
              {result.total === 1 ? "club" : "clubs"}
              {activeCategory?.blurb ? ` · ${activeCategory.blurb}` : ""}
            </>
          )}
        </p>
      </header>

      <div className="mt-8 border-y border-line py-5">
        <ClubFilters
          sort={sort}
          activeCategory={category}
          activeTag={tag}
          reviewedOnly={reviewedOnly}
          categories={categories
            .filter(
              (c) =>
                c.kind === "SOURCE" &&
                (c.clubCount > 0 || c.slug === category),
            )
            .map((c) => ({
              slug: c.slug,
              label: c.name,
              count: c.clubCount,
            }))}
          interests={categories
            .filter(
              (c) =>
                c.kind === "INTEREST" &&
                (c.clubCount > 0 || c.slug === category),
            )
            .map((c) => ({
              slug: c.slug,
              label: c.name,
              count: c.clubCount,
            }))}
          tags={tags
            .filter((t) => t.clubCount > 0 || t.slug === tag)
            .map((t) => ({ slug: t.slug, label: t.label, count: t.clubCount }))}
        />
      </div>

      {result.clubs.length === 0 ? (
        <div className="mt-16 rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm font-medium">Nothing matches those filters.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Try clearing the search or picking a different category. If the club
            you&apos;re looking for isn&apos;t here, it may not be in
            either school&apos;s directory yet.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/clubs"
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:border-accent-ring hover:text-accent"
            >
              Reset filters
            </Link>
            <Link
              href="/clubs/new"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              Add a missing club
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.clubs.map((club) => (
              <ClubCard key={club.slug} club={club} />
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted">
            Favorite club not listed?{" "}
            <Link
              href="/clubs/new"
              className="text-accent hover:text-accent-hover"
            >
              Add it
            </Link>{" "}
          </p>
        </>
      )}

      {result.pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6"
        >
          {result.page > 1 ? (
            <Link
              href={pageHref(result.page - 1)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm hover:border-accent-ring hover:text-accent"
              rel="prev"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {/* Plain GET form rather than a client-side jump-to-page control —
              the existing filters already travel as hidden fields, so
              submitting just adds/overwrites `page` in the query string,
              no JS required. */}
          <form
            action="/clubs"
            className="flex items-center gap-2 text-sm text-muted"
          >
            {q && <input type="hidden" name="q" value={q} />}
            {category && <input type="hidden" name="category" value={category} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            {reviewedOnly && <input type="hidden" name="reviewed" value="1" />}
            {rawSort && <input type="hidden" name="sort" value={sort} />}
            Page
            <input
              type="number"
              name="page"
              min={1}
              max={result.pageCount}
              defaultValue={result.page}
              aria-label="Page number"
              className="tnum w-9 rounded-md border border-line bg-surface-2 px-1 py-0.5 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span>
              of <span className="tnum">{result.pageCount}</span>
            </span>
          </form>
          {result.page < result.pageCount ? (
            <Link
              href={pageHref(result.page + 1)}
              className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm hover:border-accent-ring hover:text-accent"
              rel="next"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
