import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminClubEditForm } from "@/components/AdminClubEditForm";
import { isAdmin } from "@/lib/admin";
import { getCategoriesWithCounts, getClubBySlug } from "@/lib/clubs";

type Params = Promise<{ slug: string }>;

export const metadata: Metadata = {
  title: "Edit club",
  robots: { index: false, follow: false },
};

export default async function AdminEditClubPage({
  params,
}: {
  params: Params;
}) {
  if (!(await isAdmin())) redirect("/admin");

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
        <span>Edit (admin)</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Edit {club.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Changes apply immediately — there&apos;s no moderation queue for
          this one, since you&apos;re the moderator. Edited fields are pinned
          so the next directory re-import won&apos;t overwrite them.
        </p>
      </header>

      <div className="mt-8">
        <AdminClubEditForm
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
