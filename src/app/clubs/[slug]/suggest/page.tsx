import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SuggestEditForm } from "@/components/SuggestEditForm";
import { getClubBySlug, getCategoriesWithCounts } from "@/lib/clubs";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  return {
    title: club ? `Suggest an edit to ${club.name}` : "Club not found",
    robots: { index: false },
  };
}

export default async function SuggestEditPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [club, categories] = await Promise.all([
    getClubBySlug(slug),
    getCategoriesWithCounts(),
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
        <span>Suggest an edit</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Suggest an edit
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Everything below is the club&apos;s current information. Change what
          needs fixing and leave the rest — only what you actually change gets
          sent. A moderator reviews it before anything goes live.
        </p>
        {club.origin === "DIRECTORY" && (
          <p className="mt-3 max-w-2xl text-sm text-muted">
            This club came from Columbia&apos;s directory, which goes stale —
            dead links and old descriptions are the usual reason to edit. Once a
            correction is approved it survives future re-imports.
          </p>
        )}
      </header>

      <div className="mt-8">
        <SuggestEditForm
          club={{
            id: club.id,
            slug: club.slug,
            name: club.name,
            description: club.description,
            websiteUrl: club.websiteUrl,
            contactEmail: club.contactEmail,
            socialLinks: club.socialLinks,
            categorySlugs: club.categories.map((c) => c.category.slug),
          }}
          categoryOptions={categories.map((category) => ({
            slug: category.slug,
            name: category.name,
            kind: category.kind,
          }))}
        />
      </div>
    </div>
  );
}
