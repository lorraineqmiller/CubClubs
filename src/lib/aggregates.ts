import { prisma } from "@/lib/db";

/**
 * Recomputes a club's denormalized rating averages from its APPROVED reviews.
 *
 * Called after anything that changes which reviews are visible: publishing,
 * flagging, moderating. Doing it eagerly keeps every list page to one query,
 * which matters more than write cost here — clubs get read constantly and
 * reviewed rarely.
 */
export async function recomputeClubAggregates(clubId: string): Promise<void> {
  const [stats, howToJoin] = await Promise.all([
    prisma.review.aggregate({
      where: { clubId, status: "APPROVED" },
      _count: { _all: true },
      _avg: {
        ratingProfessional: true,
        ratingSocial: true,
        ratingCommitment: true,
        ratingOrganization: true,
        ratingRecommend: true,
      },
      _max: { publishedAt: true },
    }),
    // No SQL array-aggregation for a String[] column, so the tally is a
    // plain reduce over each review's answers — clubs have at most a
    // handful of reviews, so this is cheap.
    prisma.review.findMany({
      where: { clubId, status: "APPROVED" },
      select: { howToJoin: true },
    }),
  ]);

  const total = stats._count._all;
  const howToJoinCounts: Record<string, number> = {};
  for (const review of howToJoin) {
    for (const slug of review.howToJoin) {
      howToJoinCounts[slug] = (howToJoinCounts[slug] ?? 0) + 1;
    }
  }

  await prisma.club.update({
    where: { id: clubId },
    data: {
      reviewCount: total,
      avgProfessional: stats._avg.ratingProfessional,
      avgSocial: stats._avg.ratingSocial,
      avgCommitment: stats._avg.ratingCommitment,
      avgOrganization: stats._avg.ratingOrganization,
      avgRecommend: stats._avg.ratingRecommend,
      howToJoinCounts,
      lastReviewedAt: stats._max.publishedAt,
    },
  });
}

/**
 * Recomputes how many approved reviews cite each tag for a club, and keeps
 * ClubTag rows in step. Curated links are preserved even at count 0; community
 * links disappear when nobody cites them any more.
 */
export async function recomputeClubTagCounts(clubId: string): Promise<void> {
  const counts = await prisma.reviewTag.groupBy({
    by: ["tagId"],
    where: { review: { clubId, status: "APPROVED" } },
    _count: { tagId: true },
  });
  const countByTag = new Map(counts.map((c) => [c.tagId, c._count.tagId]));

  const existing = await prisma.clubTag.findMany({ where: { clubId } });
  const existingIds = new Set(existing.map((e) => e.tagId));

  await prisma.$transaction([
    // Refresh counts on links we already have.
    ...existing.map((link) =>
      prisma.clubTag.update({
        where: { clubId_tagId: { clubId, tagId: link.tagId } },
        data: { count: countByTag.get(link.tagId) ?? 0 },
      }),
    ),
    // Create community links for tags reviews cite that we hadn't linked yet.
    ...[...countByTag.entries()]
      .filter(([tagId]) => !existingIds.has(tagId))
      .map(([tagId, count]) =>
        prisma.clubTag.create({
          data: { clubId, tagId, count, source: "COMMUNITY" },
        }),
      ),
    // Drop community links nobody cites any more; keep curated ones.
    prisma.clubTag.deleteMany({
      where: { clubId, source: "COMMUNITY", count: 0 },
    }),
  ]);
}
