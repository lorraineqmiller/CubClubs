import type { Metadata } from "next";
import { AdminLogin, AdminToolbar, QueueCard } from "@/components/AdminQueue";
import {
  ClubSubmissionCard,
  EditSuggestionCard,
} from "@/components/AdminContributions";
import { FeedbackCard } from "@/components/AdminFeedback";
import { isAdmin, isAdminConfigured } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

// Always render fresh — a cached moderation queue is worse than useless.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <Shell>
        <p className="rounded-xl border border-caution/40 bg-caution/5 px-4 py-3 text-sm">
          <strong className="font-medium">ADMIN_TOKEN isn&apos;t set.</strong>{" "}
          Generate one with <code className="optical-reset font-mono">openssl rand -hex 32</code>{" "}
          and add it to <code className="optical-reset font-mono">.env</code> to enable
          moderation.
        </p>
      </Shell>
    );
  }

  if (!(await isAdmin())) {
    return (
      <Shell>
        <AdminLogin />
      </Shell>
    );
  }

  const [pendingSubmissions, flagged, rejected, counts] = await Promise.all([
    // Brand-new submissions awaiting their first moderator decision — never
    // published, so unlike the other two queries below there's no flagCount
    // or open flags to select.
    prisma.review.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        flagCount: true,
        status: true,
        createdAt: true,
        club: { select: { name: true, slug: true } },
        flags: { select: { id: true, reason: true, note: true, createdAt: true } },
      },
    }),
    prisma.review.findMany({
      where: { status: "FLAGGED" },
      orderBy: { flagCount: "desc" },
      select: {
        id: true,
        body: true,
        flagCount: true,
        status: true,
        createdAt: true,
        club: { select: { name: true, slug: true } },
        flags: {
          where: { resolvedAt: null },
          select: { id: true, reason: true, note: true, createdAt: true },
        },
      },
    }),
    // Reviews that carry reports but haven't crossed the auto-hide threshold —
    // still visible, worth a look before they do.
    prisma.review.findMany({
      where: { status: "APPROVED", flagCount: { gt: 0 } },
      orderBy: { flagCount: "desc" },
      take: 20,
      select: {
        id: true,
        body: true,
        flagCount: true,
        status: true,
        createdAt: true,
        club: { select: { name: true, slug: true } },
        flags: {
          where: { resolvedAt: null },
          select: { id: true, reason: true, note: true, createdAt: true },
        },
      },
    }),
    Promise.all([
      prisma.review.count({ where: { status: "APPROVED" } }),
      prisma.review.count({ where: { status: "REJECTED" } }),
      prisma.review.count({ where: { status: "PENDING" } }),
    ]),
  ]);

  // Category slugs on a suggestion need resolving to display names for the diff.
  const categoryNameBySlug = new Map(
    (await prisma.category.findMany({ select: { slug: true, name: true } })).map(
      (category) => [category.slug, category.name],
    ),
  );

  const [editSuggestions, clubSubmissions, feedback] = await Promise.all([
    prisma.clubEditSuggestion.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        club: {
          select: {
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            contactEmail: true,
            socialLinks: true,
            categories: {
              orderBy: { isPrimary: "desc" },
              select: { category: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.clubSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.siteFeedback.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <Shell>
      <AdminToolbar />

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Published" value={counts[0]} />
        <Stat label="Removed" value={counts[1]} />
        <Stat label="Awaiting approval" value={counts[2]} />
        <Stat
          label="Contributions queued"
          value={editSuggestions.length + clubSubmissions.length}
        />
        <Stat label="Feedback queued" value={feedback.length} />
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          Feedback <span className="tnum text-muted">({feedback.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Bug reports and suggestions from the footer link.
        </p>
        {feedback.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {feedback.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          New reviews{" "}
          <span className="tnum text-muted">({pendingSubmissions.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Never published — approving makes it live, rejecting discards it.
        </p>
        {pendingSubmissions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {pendingSubmissions.map((review) => (
              <QueueCard key={review.id} review={review} mode="pending" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          New clubs{" "}
          <span className="tnum text-muted">({clubSubmissions.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Clubs students say exist but aren&apos;t in Columbia&apos;s directory.
          Approving creates the club, marked community-added.
        </p>
        {clubSubmissions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {clubSubmissions.map((submission) => (
              <ClubSubmissionCard
                key={submission.id}
                item={{
                  ...submission,
                  categoryNames: submission.categorySlugs.map(
                    (slug) => categoryNameBySlug.get(slug) ?? slug,
                  ),
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          Suggested edits{" "}
          <span className="tnum text-muted">({editSuggestions.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Only changed fields are shown. Approving pins those fields so a future
          re-import of the directory can&apos;t overwrite them.
        </p>
        {editSuggestions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {editSuggestions.map((suggestion) => (
              <EditSuggestionCard
                key={suggestion.id}
                item={{
                  ...suggestion,
                  club: {
                    ...suggestion.club,
                    categoryNames: suggestion.club.categories.map(
                      (link) => link.category.name,
                    ),
                  },
                  proposedCategoryNames: suggestion.categorySlugs.map(
                    (slug) => categoryNameBySlug.get(slug) ?? slug,
                  ),
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          Hidden pending review{" "}
          <span className="tnum text-muted">({flagged.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          These crossed the report threshold and are currently hidden from the
          site.
        </p>
        {flagged.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {flagged.map((review) => (
              <QueueCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            Reported but still visible{" "}
            <span className="tnum text-muted">({rejected.length})</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Below the auto-hide threshold. Remember that reports are not votes —
            an unpopular review is not a rule-breaking one.
          </p>
          <div className="mt-4 space-y-4">
            {rejected.map((review) => (
              <QueueCard key={review.id} review={review} />
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Moderation</h1>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
