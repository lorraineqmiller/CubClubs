import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { SortKey } from "@/lib/club-sort";
import { clientIpHash } from "@/lib/ratelimit";

export const CLUBS_PER_PAGE = 24;

// Re-exported so server callers have one import, but the definitions live in
// lib/club-sort.ts because client components need them too.
export { SORT_OPTIONS, parseSort, type SortKey } from "@/lib/club-sort";

/**
 * Unreviewed clubs sort last on every rating-based order. Postgres puts NULLs
 * first on DESC by default, which would bury the handful of reviewed clubs under
 * the several hundred nobody has written about yet.
 */
function orderBy(sort: SortKey): Prisma.ClubOrderByWithRelationInput[] {
  switch (sort) {
    case "best-professionally":
      return [{ avgProfessional: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }, { sortName: "asc" }];
    case "most-fun":
      return [{ avgSocial: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }, { sortName: "asc" }];
    case "most-reviewed":
      return [{ reviewCount: "desc" }, { sortName: "asc" }];
    case "name":
    default:
      return [{ sortName: "asc" }];
  }
}

export type ListClubsParams = {
  q?: string;
  category?: string;
  tag?: string;
  sort?: SortKey;
  page?: number;
  /** Only clubs with at least one published review. */
  reviewedOnly?: boolean;
};

export async function listClubs(params: ListClubsParams) {
  const page = Math.max(1, params.page ?? 1);
  const sort = params.sort ?? "name";

  const where: Prisma.ClubWhereInput = {
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { sortName: { contains: params.q, mode: "insensitive" } },
            // Descriptions are searched too, so "hackathon" or "a cappella"
            // finds clubs whose names never say it.
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.category
      ? { categories: { some: { category: { slug: params.category } } } }
      : {}),
    ...(params.tag ? { tags: { some: { tag: { slug: params.tag } } } } : {}),
    ...(params.reviewedOnly ? { reviewCount: { gt: 0 } } : {}),
  };

  const [clubs, total] = await Promise.all([
    prisma.club.findMany({
      where,
      orderBy: orderBy(sort),
      skip: (page - 1) * CLUBS_PER_PAGE,
      take: CLUBS_PER_PAGE,
      select: {
        slug: true,
        name: true,
        origin: true,
        school: true,
        activityStatus: true,
        activityVerifiedAt: true,
        description: true,
        reviewCount: true,
        avgProfessional: true,
        avgSocial: true,
        categories: {
          orderBy: { isPrimary: "desc" },
          select: {
            isPrimary: true,
            category: { select: { name: true, slug: true, emoji: true } },
          },
        },
        tags: {
          orderBy: [{ count: "desc" }],
          take: 3,
          select: { tag: { select: { label: true, slug: true } } },
        },
      },
    }),
    prisma.club.count({ where }),
  ]);

  return {
    clubs: clubs.map((club) => ({
      slug: club.slug,
      name: club.name,
      origin: club.origin,
      school: club.school,
      activityStatus: club.activityStatus,
      activityVerifiedAt: club.activityVerifiedAt,
      description: club.description,
      reviewCount: club.reviewCount,
      avgProfessional: club.avgProfessional,
      avgSocial: club.avgSocial,
      categories: club.categories.map((c) => ({
        ...c.category,
        isPrimary: c.isPrimary,
      })),
      tags: club.tags.map((t) => t.tag),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CLUBS_PER_PAGE)),
  };
}

export async function getClubBySlug(slug: string) {
  return prisma.club.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      origin: true,
      school: true,
      activityStatus: true,
      activityVerifiedAt: true,
      description: true,
      websiteUrl: true,
      contactEmail: true,
      socialLinks: true,
      sourcePath: true,
      reviewCount: true,
      avgProfessional: true,
      avgSocial: true,
      avgCommitment: true,
      avgOrganization: true,
      avgRecommend: true,
      howToJoinCounts: true,
      lastReviewedAt: true,
      categories: {
        orderBy: { isPrimary: "desc" },
        select: {
          isPrimary: true,
          category: { select: { name: true, slug: true, emoji: true } },
        },
      },
      tags: {
        orderBy: [{ count: "desc" }, { tag: { sortOrder: "asc" } }],
        select: {
          count: true,
          source: true,
          tag: { select: { label: true, slug: true, group: true, description: true } },
        },
      },
    },
  });
}

export async function getClubReviews(clubId: string) {
  const reviews = await prisma.review.findMany({
    where: { clubId, status: "APPROVED" },
    orderBy: [{ agreeCount: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      displayId: true,
      body: true,
      ratingProfessional: true,
      ratingSocial: true,
      ratingCommitment: true,
      ratingOrganization: true,
      ratingRecommend: true,
      howToJoin: true,
      howToJoinOther: true,
      affiliation: true,
      role: true,
      yearInvolved: true,
      agreeCount: true,
      disagreeCount: true,
      publishedAt: true,
      createdAt: true,
      tags: { select: { tag: { select: { label: true, slug: true } } } },
    },
  });
  if (reviews.length === 0) return reviews.map((r) => ({ ...r, myVote: null }));

  // Attached here rather than left to the client so the UI shows the correct
  // already-voted state on first render, not just after a click this session.
  const ip = await clientIpHash();
  const votes = await prisma.reviewVote.findMany({
    where: { reviewId: { in: reviews.map((r) => r.id) }, ipHash: ip },
    select: { reviewId: true, value: true },
  });
  const voteByReview = new Map(votes.map((v) => [v.reviewId, v.value]));

  return reviews.map((review) => ({
    ...review,
    myVote: voteByReview.get(review.id) ?? null,
  }));
}

export async function getCategoriesWithCounts() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      emoji: true,
      blurb: true,
      kind: true,
      _count: { select: { clubs: true } },
    },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    blurb: c.blurb,
    kind: c.kind,
    clubCount: c._count.clubs,
  }));
}

export async function getTagsWithCounts() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: {
      slug: true,
      label: true,
      group: true,
      description: true,
      _count: { select: { clubs: true } },
    },
  });
  return tags.map((t) => ({
    slug: t.slug,
    label: t.label,
    group: t.group,
    description: t.description,
    clubCount: t._count.clubs,
  }));
}

/** Grouped for the review form and the /tags page. */
export async function getTagsGrouped() {
  const tags = await getTagsWithCounts();
  const groups = new Map<string, typeof tags>();
  for (const tag of tags) {
    const key = tag.group ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tag);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

export async function getHomepageData() {
  const [topRated, recentlyReviewed, stats] = await Promise.all([
    // "Clubs people recommend" — avgRecommend is the direct "would you
    // recommend this" signal reviewers gave, unlike the old blended avgOverall.
    prisma.club.findMany({
      where: { reviewCount: { gt: 0 } },
      orderBy: [{ avgRecommend: { sort: "desc", nulls: "last" } }, { reviewCount: "desc" }],
      take: 6,
      select: {
        slug: true,
        name: true,
        origin: true,
        school: true,
        activityStatus: true,
        activityVerifiedAt: true,
        description: true,
        reviewCount: true,
        avgProfessional: true,
        avgSocial: true,
        categories: {
          orderBy: { isPrimary: "desc" },
          select: {
            isPrimary: true,
            category: { select: { name: true, slug: true, emoji: true } },
          },
        },
        tags: {
          orderBy: { count: "desc" },
          take: 3,
          select: { tag: { select: { label: true, slug: true } } },
        },
      },
    }),
    prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        body: true,
        ratingRecommend: true,
        publishedAt: true,
        club: { select: { name: true, slug: true } },
      },
    }),
    Promise.all([
      prisma.club.count(),
      prisma.review.count({ where: { status: "APPROVED" } }),
      prisma.club.count({ where: { reviewCount: { gt: 0 } } }),
    ]),
  ]);

  const shape = (club: (typeof topRated)[number]) => ({
    slug: club.slug,
    name: club.name,
    origin: club.origin,
    school: club.school,
    activityStatus: club.activityStatus,
    activityVerifiedAt: club.activityVerifiedAt,
    description: club.description,
    reviewCount: club.reviewCount,
    avgProfessional: club.avgProfessional,
    avgSocial: club.avgSocial,
    categories: club.categories.map((c) => ({
      ...c.category,
      isPrimary: c.isPrimary,
    })),
    tags: club.tags.map((t) => t.tag),
  });

  return {
    topRated: topRated.map(shape),
    recentlyReviewed,
    stats: {
      clubCount: stats[0],
      reviewCount: stats[1],
      reviewedClubCount: stats[2],
    },
  };
}
