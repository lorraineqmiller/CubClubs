import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/ReviewForm";
import { getClubBySlug, getTagsGrouped } from "@/lib/clubs";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  return {
    title: club ? `Review ${club.name}` : "Review not found",
    // Review forms have nothing to offer a search engine, and indexing them
    // just creates duplicate thin pages.
    robots: { index: false },
  };
}

export default async function ReviewPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [club, tagGroups] = await Promise.all([
    getClubBySlug(slug),
    getTagsGrouped(),
  ]);
  if (!club) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={`/clubs/${club.slug}`} className="hover:text-accent">
          {club.name}
        </Link>
        <span aria-hidden="true" className="mx-2 text-faint">
          /
        </span>
        <span>Write a review</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Review {club.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Your review is published anonymously. A
          moderator reads it before it goes live, which usually takes less than a day.
        </p>
      </header>

      <div className="mt-8">
        <ReviewForm
          clubId={club.id}
          clubName={club.name}
          clubSlug={club.slug}
          tagGroups={tagGroups.map((group) => ({
            group: group.group,
            items: group.items.map((tag) => ({
              slug: tag.slug,
              label: tag.label,
              description: tag.description,
            })),
          }))}
        />
      </div>
    </div>
  );
}
