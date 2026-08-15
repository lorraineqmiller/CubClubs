import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityBadge } from "@/components/ActivityBadge";
import { ActivityStatusControl } from "@/components/ActivityStatusControl";
import { CategoryIcon } from "@/components/CategoryIcon";
import { RatingBar } from "@/components/RatingBar";
import { ReviewCard } from "@/components/ReviewCard";
import { isAdmin } from "@/lib/admin";
import { getClubBySlug, getClubReviews } from "@/lib/clubs";
import { HOW_TO_JOIN_LABEL_BY_SLUG, RATING_DIMENSIONS, type RatingKey } from "@/lib/ratings";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return { title: "Club not found" };

  const rating =
    club.avgRecommend != null
      ? `${club.avgRecommend.toFixed(1)}/5 would recommend it, from ${club.reviewCount} anonymous review${club.reviewCount === 1 ? "" : "s"}.`
      : "No reviews yet — be the first.";
  return {
    title: club.name,
    description: `${club.name} at Columbia & Barnard. ${rating}`,
  };
}

/** Hostname only, for a tidier external link label. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Recognizes the handful of platforms the directory actually links to. */
function socialLabel(url: string): string {
  const host = hostOf(url).toLowerCase();
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("facebook")) return "Facebook";
  if (host.includes("twitter") || host === "x.com") return "X";
  if (host.includes("linkedin")) return "LinkedIn";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("youtube")) return "YouTube";
  if (host.includes("discord")) return "Discord";
  if (host.includes("linktr")) return "Linktree";
  return host;
}

export default async function ClubPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [club, admin] = await Promise.all([getClubBySlug(slug), isAdmin()]);
  if (!club) notFound();

  const reviews = await getClubReviews(club.id);
  const primary = club.categories.find((c) => c.isPrimary) ?? club.categories[0];
  const cited = club.tags.filter((t) => t.count > 0);

  // dim.field is the Review column ("ratingProfessional"); the Club aggregate
  // it's averaged into keeps a matching but not identical name in two cases
  // (avgProfessional/avgSocial were reused rather than renamed — see
  // schema.prisma) and a new one in the other two — hence the explicit map
  // rather than a naming convention the field names can't quite deliver.
  const avgByKey: Record<RatingKey, number | null> = {
    professional: club.avgProfessional,
    community: club.avgSocial,
    commitment: club.avgCommitment,
    organization: club.avgOrganization,
    recommend: club.avgRecommend,
  };

  const howToJoinCounts = (club.howToJoinCounts ?? {}) as Record<string, number>;
  const howToJoinEntries = Object.entries(howToJoinCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/clubs" className="hover:text-accent">
          All clubs
        </Link>
        {primary && (
          <>
            <span aria-hidden="true" className="mx-2 text-faint">
              /
            </span>
            <Link
              href={`/clubs?category=${primary.category.slug}`}
              className="hover:text-accent"
            >
              {primary.category.name}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {club.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActivityBadge status={club.activityStatus} verifiedAt={club.activityVerifiedAt} />
        </div>

        {admin && (
          <ActivityStatusControl clubId={club.id} currentStatus={club.activityStatus} />
        )}

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {club.categories.map(({ category }) => (
            <li key={category.slug}>
              <Link
                href={`/clubs?category=${category.slug}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:border-accent-ring hover:text-accent"
              >
                <CategoryIcon slug={category.slug} />
                {category.name}
              </Link>
            </li>
          ))}
        </ul>

        {club.description && (
          // Descriptions keep their paragraph breaks from the source.
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted">
            {club.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/clubs/${club.slug}/review`}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Write a review
          </Link>
          {club.websiteUrl && (
            <a
              href={club.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm hover:border-accent-ring hover:text-accent"
            >
              {hostOf(club.websiteUrl)} ↗
            </a>
          )}
          <Link
            href={`/clubs/${club.slug}/suggest`}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted hover:border-accent-ring hover:text-accent"
          >
            Suggest an edit
          </Link>
          {admin && (
            <Link
              href={`/admin/clubs/${club.slug}/edit`}
              className="rounded-lg border border-accent-ring bg-accent-soft px-4 py-2.5 text-sm text-accent hover:bg-accent-soft/70"
            >
              Edit (admin)
            </Link>
          )}
        </div>

        {(club.contactEmail || club.socialLinks.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            {club.contactEmail && (
              <span>
                <span className="text-faint">Contact: </span>
                {/* Rendered as text rather than a mailto: link. These are the
                    club inboxes the directory publishes, but turning 350 of
                    them into harvestable links is a favour to scrapers, not to
                    students — anyone who wants it can copy it. */}
                {/* text-[22px] has to sit on this wrapper rather than share
                    optical-reset's element — optical-reset's calc(1em / 1.7)
                    resolves against the *inherited* size, so a font-size on
                    the same element would just be discarded. */}
                <span className="text-[22px]">
                  <span className="optical-reset font-mono text-text">
                    {club.contactEmail}
                  </span>
                </span>
              </span>
            )}
            {club.socialLinks.length > 0 && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {club.socialLinks.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:text-accent"
                  >
                    {socialLabel(url)} ↗
                  </a>
                ))}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Ratings */}
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Ratings</h2>
          <p className="text-sm text-muted">
            {club.reviewCount === 0
              ? "No reviews yet"
              : `From ${club.reviewCount} anonymous review${club.reviewCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {club.reviewCount === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line py-10 text-center">
            <p className="text-sm font-medium">Nobody has reviewed this club yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
              If you&apos;ve been a member, you&apos;re the person who can tell
              everyone else what it&apos;s really like.
            </p>
            <Link
              href={`/clubs/${club.slug}/review`}
              className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              Write the first review
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {RATING_DIMENSIONS.map((dim) => (
                <div
                  key={dim.key}
                  className={dim.key === "recommend" ? "sm:col-span-2" : undefined}
                >
                  <RatingBar dimension={dim.key} value={avgByKey[dim.key]} />
                </div>
              ))}
            </div>

            {avgByKey.commitment != null && (
              <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
                Commitment isn&apos;t a score — it describes how demanding the
                club actually is, not whether that&apos;s good or bad.
              </p>
            )}

            {howToJoinEntries.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-sm font-semibold text-text">
                  How people got in
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {howToJoinEntries.map(([optionSlug, count]) => (
                    <li
                      key={optionSlug}
                      className="tnum inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm text-muted"
                    >
                      {HOW_TO_JOIN_LABEL_BY_SLUG[optionSlug] ?? optionSlug}
                      <span className="rounded-full bg-surface px-1.5 text-xs">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Tags */}
      {cited.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            What reviewers say about it
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cited.map(({ tag, count }) => (
              <li key={tag.slug}>
                <Link
                  href={`/clubs?tag=${tag.slug}`}
                  title={tag.description ?? undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:border-accent-ring hover:text-accent"
                >
                  {tag.label}
                  <span className="tnum rounded-full bg-surface-2 px-1.5 text-[19px]">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {reviews.length === 0
              ? "Reviews"
              : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
          </h2>
          {reviews.length > 1 && (
            <p className="text-sm text-faint">Most agreed first</p>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="mt-5 space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} clubSlug={club.slug} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 space-y-2 border-t border-line pt-5 text-xs text-faint">
        <p>
          {club.origin === "DIRECTORY" && club.school === "BARNARD" ? (
            <>
              Club details come from{" "}
              <a
                href="https://barnard.edu/student-organizations"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-accent"
              >
                Barnard&apos;s student organizations directory
              </a>
              , with any corrections students have sent us.
            </>
          ) : club.origin === "DIRECTORY" && club.sourcePath ? (
            <>
              Club details come from{" "}
              <a
                href={`https://undergrad.admissions.columbia.edu${club.sourcePath}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-accent"
              >
                Columbia&apos;s student group directory
              </a>
              , with any corrections students have sent us.
            </>
          ) : (
            <>
              This club was submitted by a student and checked by a moderator. It
              isn&apos;t in Columbia&apos;s official directory, so its details
              come from whoever added it.
            </>
          )}{" "}
          Ratings and reviews are the opinions of individual students.
        </p>
        <p>
          Something wrong?{" "}
          <Link
            href={`/clubs/${club.slug}/suggest`}
            className="underline hover:text-accent"
          >
            Suggest an edit
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
