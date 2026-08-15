import type { Metadata } from "next";
import Link from "next/link";
import { NewClubForm } from "@/components/NewClubForm";
import { getCategoriesWithCounts } from "@/lib/clubs";

export const metadata: Metadata = {
  title: "Add a club",
  description:
    "Submit a Columbia or Barnard club that isn't in the university's official directory yet.",
};

// The category picker comes from the database, so don't bake it in at build time.
export const revalidate = 300;

export default async function NewClubPage() {
  const categories = await getCategoriesWithCounts();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/clubs" className="hover:text-accent">
          All clubs
        </Link>
        <span aria-hidden="true" className="mx-2 text-faint">
          /
        </span>
        <span>Add a club</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Add a club</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          For clubs that aren&apos;t in Columbia&apos;s official directory — new or unaffiliated
          groups. A moderator must confirm it exists before it appears.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-accent-ring bg-surface p-4 text-sm leading-relaxed">
        <p className="font-medium">Worth knowing</p>
        <ul className="mt-2 space-y-1.5 text-muted">
          <li>
            Check it isn&apos;t{" "}
            <Link href="/clubs" className="text-accent underline">
              already listed
            </Link>{" "}
            first. Columbia's official directory has 476 clubs and its official name may differ from what
            people call it.
          </li>
        </ul>
      </div>

      <div className="mt-8">
        <NewClubForm
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
