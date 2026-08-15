"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, checkAdminToken, isAdmin } from "@/lib/admin";
import { recomputeClubAggregates, recomputeClubTagCounts } from "@/lib/aggregates";
import { sortKey, uniqueSlug } from "@/lib/slug";

export async function adminLogin(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  if (!checkAdminToken(token)) {
    return { error: "That token isn't right." };
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  revalidatePath("/admin");
  return {};
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}

export type ModerationAction = "approve" | "reject";

/**
 * Resolves a review either way — whether it's a brand-new PENDING submission
 * or a previously-published one that got FLAGGED — and recomputes the club's
 * aggregates, since either direction changes which reviews count towards them.
 *
 * The two cases diverge on reject: a FLAGGED review was live before, so
 * rejecting it takes down and keeps a record (REJECTED, same as always). A
 * PENDING review was never live — there's nothing to "take down", and nothing
 * identifying to keep a record of, so rejecting it just deletes the row.
 */
export async function moderateReview(
  reviewId: string,
  action: ModerationAction,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) {
    return { ok: false, message: "Not authorized." };
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      clubId: true,
      publishedAt: true,
      club: { select: { slug: true } },
    },
  });
  if (!review) return { ok: false, message: "That review no longer exists." };

  if (action === "reject" && review.publishedAt === null) {
    await prisma.review.delete({ where: { id: review.id } });
  } else {
    await prisma.review.update({
      where: { id: review.id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        moderatedAt: new Date(),
        ...(action === "approve"
          ? {
              // First approval publishes it; re-approving a restored review
              // shouldn't move its original publish date.
              publishedAt: review.publishedAt ?? new Date(),
              // Clear the counter on restore so one wave of reports can't
              // immediately re-hide a review a moderator has already cleared.
              flagCount: 0,
            }
          : {}),
      },
    });

    await prisma.reviewFlag.updateMany({
      where: { reviewId: review.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }

  await recomputeClubAggregates(review.clubId);
  await recomputeClubTagCounts(review.clubId);

  revalidatePath("/admin");
  revalidatePath(`/clubs/${review.club.slug}`);
  revalidatePath("/clubs");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Community contributions
// ---------------------------------------------------------------------------

/**
 * Applies an approved edit to its club.
 *
 * Every field the suggestion actually proposed is copied over, and its name is
 * recorded in `Club.editedFields` so the seed stops overwriting it from the
 * directory. Without that second step the change would survive exactly until
 * the next `npm run scrape && npm run seed`.
 *
 * The slug is deliberately left alone even when the name changes: it's in every
 * link people have shared and in the review URLs, and renaming a club is not
 * worth breaking those.
 */
export async function reviewClubEdit(
  suggestionId: string,
  action: ModerationAction,
  moderatorNote?: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };

  const suggestion = await prisma.clubEditSuggestion.findUnique({
    where: { id: suggestionId },
    include: { club: { select: { id: true, slug: true, editedFields: true } } },
  });
  if (!suggestion) return { ok: false, message: "That suggestion is gone." };
  if (suggestion.status !== "PENDING") {
    return { ok: false, message: "Already reviewed." };
  }

  if (action === "reject") {
    await prisma.clubEditSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "REJECTED", reviewedAt: new Date(), moderatorNote },
    });
    revalidatePath("/admin");
    return { ok: true };
  }

  const data: Record<string, unknown> = {};
  const edited = new Set(suggestion.club.editedFields);

  if (suggestion.name !== null) {
    data.name = suggestion.name;
    data.sortName = sortKey(suggestion.name);
    edited.add("name");
  }
  if (suggestion.description !== null) {
    data.description = suggestion.description;
    edited.add("description");
  }
  if (suggestion.websiteUrl !== null) {
    data.websiteUrl = suggestion.websiteUrl;
    edited.add("websiteUrl");
  }
  if (suggestion.contactEmail !== null) {
    data.contactEmail = suggestion.contactEmail;
    edited.add("contactEmail");
  }
  if (suggestion.socialLinks.length > 0) {
    data.socialLinks = suggestion.socialLinks;
    edited.add("socialLinks");
  }

  if (suggestion.categorySlugs.length > 0) {
    const categories = await prisma.category.findMany({
      where: { slug: { in: suggestion.categorySlugs } },
      select: { id: true, slug: true, kind: true },
    });
    if (categories.length === 0) {
      return { ok: false, message: "None of those categories exist any more." };
    }
    // Primary must be a SOURCE category — that's what the club badge and
    // breadcrumb show. Fall back to the first one if the suggestion only
    // proposed interest areas.
    const ordered = [
      ...categories.filter((category) => category.kind === "SOURCE"),
      ...categories.filter((category) => category.kind !== "SOURCE"),
    ];
    await prisma.clubCategory.deleteMany({ where: { clubId: suggestion.club.id } });
    await prisma.clubCategory.createMany({
      data: ordered.map((category, index) => ({
        clubId: suggestion.club.id,
        categoryId: category.id,
        isPrimary: index === 0,
      })),
    });
    edited.add("categories");
  }

  data.editedFields = [...edited];

  await prisma.club.update({ where: { id: suggestion.club.id }, data });
  await prisma.clubEditSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "APPROVED", reviewedAt: new Date(), moderatorNote },
  });

  revalidatePath(`/clubs/${suggestion.club.slug}`);
  revalidatePath("/clubs");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Turns an approved submission into a real club.
 *
 * The club is created with `origin: COMMUNITY`, which does two jobs: the UI
 * labels it as not officially recognized, and `pruneDelisted` in the seed skips
 * it — otherwise the next `npm run seed -- --prune` would delete every
 * student-submitted club, since none of them are in clubs.json.
 */
export async function reviewClubSubmission(
  submissionId: string,
  action: ModerationAction,
  moderatorNote?: string,
): Promise<{ ok: boolean; message?: string; slug?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };

  const submission = await prisma.clubSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { ok: false, message: "That submission is gone." };
  if (submission.status !== "PENDING") {
    return { ok: false, message: "Already reviewed." };
  }

  if (action === "reject") {
    await prisma.clubSubmission.update({
      where: { id: submission.id },
      data: { status: "REJECTED", reviewedAt: new Date(), moderatorNote },
    });
    revalidatePath("/admin");
    return { ok: true };
  }

  const categories = await prisma.category.findMany({
    where: { slug: { in: submission.categorySlugs } },
    select: { id: true, kind: true },
  });
  if (categories.length === 0) {
    return {
      ok: false,
      message: "None of the proposed categories exist any more.",
    };
  }
  const ordered = [
    ...categories.filter((category) => category.kind === "SOURCE"),
    ...categories.filter((category) => category.kind !== "SOURCE"),
  ];

  const slug = await uniqueSlug(
    submission.name,
    async (candidate) =>
      (await prisma.club.count({ where: { slug: candidate } })) > 0,
    submission.id,
  );

  const club = await prisma.club.create({
    data: {
      origin: "COMMUNITY",
      // Namespaced so it can never collide with a directory slug, and so the
      // provenance of a club is obvious straight from the database.
      sourceId: `community:${submission.id}`,
      slug,
      name: submission.name,
      sortName: sortKey(submission.name),
      description: submission.description,
      websiteUrl: submission.websiteUrl,
      contactEmail: submission.contactEmail,
      socialLinks: submission.socialLinks,
      sourcePath: null,
      // A moderator just personally confirmed this club is real by approving
      // the submission — unlike a bulk-imported directory club, which starts
      // AWAITING_VERIFICATION because nobody's looked at it individually.
      activityStatus: "ACTIVE",
      activityVerifiedAt: new Date(),
      // Nothing here came from the directory, so everything is community-owned
      // and the seed has no business touching any of it.
      editedFields: [
        "name",
        "description",
        "websiteUrl",
        "contactEmail",
        "socialLinks",
        "categories",
      ],
      categories: {
        create: ordered.map((category, index) => ({
          categoryId: category.id,
          isPrimary: index === 0,
        })),
      },
    },
    select: { id: true, slug: true },
  });

  await prisma.clubSubmission.update({
    where: { id: submission.id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      moderatorNote,
      createdClubId: club.id,
    },
  });

  revalidatePath("/clubs");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, slug: club.slug };
}

// ---------------------------------------------------------------------------
// Club activity status
// ---------------------------------------------------------------------------

export type ActivityStatusValue = "ACTIVE" | "INACTIVE" | "AWAITING_VERIFICATION";

/**
 * Sets whether a club is still meeting. Nothing scrapes or infers this — a
 * moderator looked, which is the entire point of the "as of" date the badge
 * shows (see ActivityBadge). Exposed inline on the club's own page rather
 * than a separate admin screen, since that's exactly where an admin already
 * is when they'd naturally decide to check.
 */
export async function setClubActivityStatus(
  clubId: string,
  status: ActivityStatusValue,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };

  const club = await prisma.club.update({
    where: { id: clubId },
    data: { activityStatus: status, activityVerifiedAt: new Date() },
    select: { slug: true },
  });

  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Site feedback
// ---------------------------------------------------------------------------

/**
 * Resolves a bug report or suggestion. Reuses ModerationAction/SubmissionStatus
 * for consistency with the contribution queues above, though the UI labels
 * the two decisions "Mark resolved"/"Dismiss" — there's nothing to publish,
 * just something to acknowledge.
 */
export async function reviewFeedback(
  feedbackId: string,
  action: ModerationAction,
  moderatorNote?: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };

  const feedback = await prisma.siteFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, status: true },
  });
  if (!feedback) return { ok: false, message: "That item is gone." };
  if (feedback.status !== "PENDING") {
    return { ok: false, message: "Already reviewed." };
  }

  await prisma.siteFeedback.update({
    where: { id: feedback.id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      moderatorNote,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Direct club edits
// ---------------------------------------------------------------------------

export type AdminClubEditState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const MAX_SOCIAL_LINKS = 5;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Please give a full URL starting with http:// or https://" },
  );

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "That doesn't look like an email address.",
  });

const AdminClubEditInput = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required.").max(200),
  description: optionalText(4000),
  websiteUrl: optionalUrl,
  contactEmail: optionalEmail,
});

/**
 * Applies directly — no moderation queue, since the person making the change
 * is the moderator. Every field submitted through this form gets recorded in
 * `Club.editedFields` (same mechanism `reviewClubEdit` uses for a community
 * suggestion), so the next `npm run seed` won't stomp it with a re-scraped
 * directory value.
 */
export async function adminUpdateClub(
  _prev: AdminClubEditState,
  formData: FormData,
): Promise<AdminClubEditState> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };

  const parsed = AdminClubEditInput.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return { ok: false, message: "Some of that needs fixing.", errors };
  }

  const club = await prisma.club.findUnique({
    where: { id: parsed.data.clubId },
    select: { id: true, slug: true, editedFields: true },
  });
  if (!club) return { ok: false, message: "That club no longer exists." };

  const lines = String(formData.get("socialLinks") ?? "")
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
  const socialLinks: string[] = [];
  const invalid: string[] = [];
  for (const line of lines.slice(0, MAX_SOCIAL_LINKS)) {
    try {
      const url = new URL(line);
      if (url.protocol === "http:" || url.protocol === "https:") {
        socialLinks.push(url.toString());
        continue;
      }
      invalid.push(line);
    } catch {
      invalid.push(line);
    }
  }
  if (invalid.length) {
    return {
      ok: false,
      errors: {
        socialLinks: `Couldn't read ${invalid.length === 1 ? "this link" : "these links"}: ${invalid.join(", ")}`,
      },
    };
  }

  const categorySlugs = formData.getAll("categories").map(String);
  const categories = categorySlugs.length
    ? await prisma.category.findMany({
        where: { slug: { in: categorySlugs } },
        select: { id: true, kind: true },
      })
    : [];
  if (categorySlugs.length > 0 && categories.length === 0) {
    return { ok: false, message: "None of those categories exist any more." };
  }

  const edited = new Set(club.editedFields);
  edited.add("name");
  edited.add("description");
  edited.add("websiteUrl");
  edited.add("contactEmail");
  edited.add("socialLinks");
  if (categories.length > 0) edited.add("categories");

  await prisma.club.update({
    where: { id: club.id },
    data: {
      name: parsed.data.name,
      sortName: sortKey(parsed.data.name),
      description: parsed.data.description,
      websiteUrl: parsed.data.websiteUrl,
      contactEmail: parsed.data.contactEmail,
      socialLinks,
      editedFields: [...edited],
    },
  });

  if (categories.length > 0) {
    const ordered = [
      ...categories.filter((category) => category.kind === "SOURCE"),
      ...categories.filter((category) => category.kind !== "SOURCE"),
    ];
    await prisma.clubCategory.deleteMany({ where: { clubId: club.id } });
    await prisma.clubCategory.createMany({
      data: ordered.map((category, index) => ({
        clubId: club.id,
        categoryId: category.id,
        isPrimary: index === 0,
      })),
    });
  }

  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}
