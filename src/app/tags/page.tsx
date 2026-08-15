import type { Metadata } from "next";
import Link from "next/link";
import { getTagsGrouped } from "@/lib/clubs";

export const metadata: Metadata = {
  title: "Tags",
  description:
    "Tags reviewers attach to Columbia and Barnard clubs — commitment level, how you get in, culture, and payoff.",
};

// Per-tag club counts grow as reviews cite tags, so this can't be static.
export const revalidate = 300;

export default async function TagsPage() {
  const groups = await getTagsGrouped();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Tags</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Reviewers attach tags to describe what a club is actually like. A tag
        appears on a club once someone cites it, and the number shows how many
        clubs carry it.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-faint">
        This vocabulary is a starting point and will change — the groups below are
        stored as plain labels precisely so tags can be added or renamed without
        a database migration.
      </p>

      <div className="mt-10 space-y-10">
        {groups.map((group) => (
          <section key={group.group}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
              {group.group}
            </h2>
            <ul className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line bg-surface">
              {group.items.map((tag) => (
                <li key={tag.slug}>
                  {tag.clubCount > 0 ? (
                    <Link
                      href={`/clubs?tag=${tag.slug}`}
                      className="flex items-baseline gap-3 px-4 py-3 hover:bg-accent-soft/40"
                    >
                      <span className="font-medium">{tag.label}</span>
                      {tag.description && (
                        <span className="flex-1 text-sm text-muted">
                          {tag.description}
                        </span>
                      )}
                      <span className="tnum shrink-0 text-xs text-faint">
                        {tag.clubCount} club{tag.clubCount === 1 ? "" : "s"}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-baseline gap-3 px-4 py-3">
                      <span className="font-medium text-muted">{tag.label}</span>
                      {tag.description && (
                        <span className="flex-1 text-sm text-faint">
                          {tag.description}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-faint">unused</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
