"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { recomputeClubAggregates, recomputeClubTagCounts } from "@/lib/aggregates";
import { checkRateLimit, clientIpHash, LIMITS } from "@/lib/ratelimit";
import {
  HOW_TO_JOIN_OPTIONS,
  HOW_TO_JOIN_OTHER_SLUG,
  MAX_BODY_LENGTH,
  MIN_BODY_LENGTH,
} from "@/lib/ratings";

const rating5 = z.coerce.number().int().min(1).max(5);
const howToJoinSlugs = new Set(HOW_TO_JOIN_OPTIONS.map((o) => o.slug));

const ReviewInput = z
  .object({
    clubId: z.string().min(1),
    body: z
      .string()
      .trim()
      .min(
        MIN_BODY_LENGTH,
        `Please write at least ${MIN_BODY_LENGTH} characters — enough to actually be useful to someone.`,
      )
      .max(MAX_BODY_LENGTH, "That's longer than the maximum of 5,000 characters."),
    ratingProfessional: rating5,
    ratingSocial: rating5,
    ratingCommitment: rating5,
    ratingOrganization: rating5,
    ratingRecommend: rating5,
    howToJoin: z
      .array(z.string())
      .min(1, "Pick at least one.")
      .refine((slugs) => slugs.every((s) => howToJoinSlugs.has(s)), {
        message: "Pick from the listed options.",
      }),
    howToJoinOther: z.string().trim().max(200).optional(),
    affiliation: z
      .enum([
        "COLUMBIA_CC",
        "COLUMBIA_SEAS",
        "COLUMBIA_GS",
        "BARNARD",
        "GRADUATE",
        "OTHER",
      ])
      .optional(),
    role: z
      .enum(["CURRENT_MEMBER", "FORMER_MEMBER", "BOARD_MEMBER"])
      .optional(),
    yearInvolved: z.coerce
      .number()
      .int()
      .min(1990)
      .max(new Date().getFullYear() + 1)
      .optional(),
    tagSlugs: z.array(z.string()).max(8, "Pick at most 8 tags.").default([]),
  })
  .refine(
    (data) =>
      !data.howToJoin.includes(HOW_TO_JOIN_OTHER_SLUG) ||
      Boolean(data.howToJoinOther),
    {
      message: "Say a bit about how you got in.",
      path: ["howToJoinOther"],
    },
  );

export type ReviewFormState = {
  ok: boolean;
  message?: string;
  /** Field-level errors keyed by input name. */
  errors?: Record<string, string>;
  /** Set on success so the form can show the "awaiting approval" state. */
  submitted?: boolean;
};

/** Reads a multi-value field (`tags`, `howToJoin`) out of a FormData submission. */
function readMulti(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}

function optional(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

export async function submitReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const parsed = ReviewInput.safeParse({
    clubId: formData.get("clubId"),
    body: formData.get("body") ?? "",
    ratingProfessional: formData.get("ratingProfessional"),
    ratingSocial: formData.get("ratingSocial"),
    ratingCommitment: formData.get("ratingCommitment"),
    ratingOrganization: formData.get("ratingOrganization"),
    ratingRecommend: formData.get("ratingRecommend"),
    howToJoin: readMulti(formData, "howToJoin"),
    howToJoinOther: optional(formData, "howToJoinOther"),
    affiliation: optional(formData, "affiliation"),
    role: optional(formData, "role"),
    yearInvolved: optional(formData, "yearInvolved"),
    tagSlugs: readMulti(formData, "tags"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      // An unset rating arrives as "" and coerces to 0, so zod's own message
      // would be "expected >= 1" — useless to a reader.
      errors[key] = key.startsWith("rating")
        ? "Please pick a rating."
        : issue.message;
    }
    return {
      ok: false,
      message: "Some of that needs fixing before we can submit your review.",
      errors,
    };
  }

  const input = parsed.data;

  const club = await prisma.club.findUnique({
    where: { id: input.clubId },
    select: { id: true, name: true, slug: true },
  });
  if (!club) {
    return { ok: false, message: "That club no longer exists." };
  }

  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.reviewSubmit, hashedIp);
  if (!limit.ok) {
    return {
      ok: false,
      message:
        "That's a lot of reviews at once. Try again in an hour — if you're " +
        "genuinely reviewing this many clubs, get in touch and we'll sort it out.",
    };
  }

  const tags = await prisma.tag.findMany({
    where: { slug: { in: input.tagSlugs } },
    select: { id: true },
  });

  // Held as PENDING until a moderator approves it — see the admin queue.
  // Nothing here identifies the submitter; abuse is handled by the IP-based
  // rate limit above, not by anything tied to this specific review row.
  await prisma.review.create({
    data: {
      clubId: club.id,
      body: input.body,
      ratingProfessional: input.ratingProfessional,
      ratingSocial: input.ratingSocial,
      ratingCommitment: input.ratingCommitment,
      ratingOrganization: input.ratingOrganization,
      ratingRecommend: input.ratingRecommend,
      howToJoin: input.howToJoin,
      howToJoinOther: input.howToJoin.includes(HOW_TO_JOIN_OTHER_SLUG)
        ? input.howToJoinOther
        : undefined,
      affiliation: input.affiliation,
      role: input.role,
      yearInvolved: input.yearInvolved,
      status: "PENDING",
      tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
    },
  });

  return { ok: true, submitted: true };
}

/**
 * Agrees or disagrees with a review. `ReviewVote`'s unique (reviewId, ipHash)
 * constraint is what actually enforces one vote per IP — this catches that
 * as a friendly message rather than a 500, it doesn't invent the rule.
 */
export async function voteOnReview(
  reviewId: string,
  clubSlug: string,
  value: "AGREE" | "DISAGREE",
): Promise<{ ok: boolean; message?: string }> {
  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.vote, hashedIp);
  if (!limit.ok) return { ok: false, message: "Slow down a moment." };

  try {
    await prisma.reviewVote.create({
      data: { reviewId, ipHash: hashedIp, value },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: "You've already voted on this review." };
    }
    throw error;
  }

  await prisma.review.update({
    where: { id: reviewId },
    data:
      value === "AGREE"
        ? { agreeCount: { increment: 1 } }
        : { disagreeCount: { increment: 1 } },
  });
  revalidatePath(`/clubs/${clubSlug}`);
  return { ok: true };
}

const FlagInput = z.object({
  reviewId: z.string().min(1),
  clubSlug: z.string().min(1),
  reason: z.enum([
    "HARASSMENT",
    "IDENTIFYING_INFO",
    "SPAM",
    "OFF_TOPIC",
    "FACTUALLY_WRONG",
    "OTHER",
  ]),
  note: z.string().trim().max(500).optional(),
});

/** Number of flags that hides a review pending moderator review. */
const AUTO_HIDE_THRESHOLD = 3;

export async function flagReview(
  _prev: { ok: boolean; message?: string },
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = FlagInput.safeParse({
    reviewId: formData.get("reviewId"),
    clubSlug: formData.get("clubSlug"),
    reason: formData.get("reason"),
    note: optional(formData, "note"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Please pick a reason." };
  }

  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.flag, hashedIp);
  if (!limit.ok) {
    return { ok: false, message: "Too many reports from here. Try again later." };
  }

  const review = await prisma.review.findUnique({
    where: { id: parsed.data.reviewId },
    select: { id: true, flagCount: true, status: true },
  });
  if (!review) return { ok: false, message: "That review no longer exists." };

  await prisma.reviewFlag.create({
    data: {
      reviewId: review.id,
      reason: parsed.data.reason,
      note: parsed.data.note,
      ipHash: hashedIp,
    },
  });

  const flagCount = review.flagCount + 1;
  const shouldHide =
    review.status === "APPROVED" && flagCount >= AUTO_HIDE_THRESHOLD;

  await prisma.review.update({
    where: { id: review.id },
    data: {
      flagCount,
      ...(shouldHide ? { status: "FLAGGED" } : {}),
    },
  });

  if (shouldHide) {
    // Hiding changes what's visible, so the averages have to move with it.
    const full = await prisma.review.findUnique({
      where: { id: review.id },
      select: { clubId: true },
    });
    if (full) {
      await recomputeClubAggregates(full.clubId);
      await recomputeClubTagCounts(full.clubId);
    }
  }

  revalidatePath(`/clubs/${parsed.data.clubSlug}`);
  return {
    ok: true,
    message:
      "Thanks — a moderator will take a look. We don't remove reviews just for being negative.",
  };
}
