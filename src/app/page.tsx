import Link from "next/link";
import { Suspense } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ClubCard } from "@/components/ClubCard";
import { SearchBox } from "@/components/SearchBox";
import { getCategoriesWithCounts, getHomepageData } from "@/lib/clubs";
import { RATING_DIMENSIONS } from "@/lib/ratings";

/**
 * Prerendered, but the counts and top-rated list come from the database, so it
 * must not be frozen at build time. Publishing a review calls revalidatePath("/")
 * for an immediate refresh; this is the backstop for anything that changes
 * without going through that path (moderation, a re-seed).
 */
export const revalidate = 300;

export default async function HomePage() {
  const [{ topRated, recentlyReviewed, stats }, categories] = await Promise.all(
    [getHomepageData(), getCategoriesWithCounts()],
  );
  const interestAreas = categories.filter(
    (category) => category.kind === "INTEREST" && category.clubCount > 0,
  );

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <section className="border-b border-[color:var(--divider-strong)] py-14 sm:py-20">
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[0.65] tracking-tight sm:text-5xl">
            skip the club fair, 
            <span className="text-muted"> see what real members have to say</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Anonymous reviews of CU student organizations from active and former
            members
          </p>

          <div className="mt-8 max-w-xl">
            <Suspense fallback={<div className="h-[42px]" />}>
              <SearchBox />
            </Suspense>
          </div>

          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Clubs listed</dt>
              <dd className="tnum font-semibold">{stats.clubCount}</dd>
              <span className="text-muted">clubs listed</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Reviews</dt>
              <dd className="tnum font-semibold">{stats.reviewCount}</dd>
              <span className="text-muted">reviews, and counting</span>
            </div>
          </dl>
        </section>

        {/* Categories */}
        <section className="border-b border-[color:var(--divider-strong)] py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              Browse by category
            </h2>
            <Link
              href="/clubs"
              className="text-sm text-accent hover:text-accent-hover"
            >
              All clubs →
            </Link>
          </div>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {categories
              .filter(
                (category) =>
                  category.kind === "SOURCE" && category.clubCount > 0,
              )
              .map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/clubs?category=${category.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors hover:border-accent-ring hover:text-accent"
                  >
                    <CategoryIcon slug={category.slug} size={20} />
                    <span className="flex-1 text-base font-medium">
                      {category.name}
                    </span>
                    <span className="tnum text-sm text-faint">
                      {category.clubCount}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>

          {interestAreas.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                Or by interest area
              </h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {interestAreas.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/clubs?category=${category.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-muted transition-colors hover:border-accent-ring hover:text-accent"
                    >
                      <CategoryIcon slug={category.slug} />
                      {category.name}
                      <span className="tnum text-sm text-faint">
                        {category.clubCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Top rated */}
        {topRated.length > 0 && (
          <section className="border-b border-[color:var(--divider-strong)] py-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                Clubs people recommend
              </h2>
              <Link
                href="/clubs"
                className="text-sm text-accent hover:text-accent-hover"
              >
                See all →
              </Link>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topRated.map((club) => (
                <ClubCard key={club.slug} club={club} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
