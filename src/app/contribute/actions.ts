"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIpHash, LIMITS } from "@/lib/ratelimit";

/**
 * Public submission actions: proposing an edit to a club, and proposing a club
 * that isn't in Columbia's directory.
 *
 * Neither publishes anything. Both create a PENDING row for a moderator, which
 * is why they don't require email verification the way reviews do — see the
 * comment above the models in schema.prisma.
 */

export type SubmissionFormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const MAX_SOCIAL_LINKS = 5;

/** Empty string → undefined, so "left blank" and "cleared" aren't confused. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
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
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "That doesn't look like an email address.",
  });

/**
 * Social links arrive as one textarea, one URL per line — simpler for the
 * submitter than a repeating field, and the moderator sees them as a list.
 */
function parseSocialLinks(raw: FormDataEntryValue | null): {
  links: string[];
  invalid: string[];
} {
  const lines = String(raw ?? "")
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
  const links: string[] = [];
  const invalid: string[] = [];
  for (const line of lines.slice(0, MAX_SOCIAL_LINKS)) {
    try {
      const url = new URL(line);
      if (url.protocol === "http:" || url.protocol === "https:") {
        links.push(url.toString());
        continue;
      }
      invalid.push(line);
    } catch {
      invalid.push(line);
    }
  }
  return { links, invalid };
}

function collectIssues(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[String(issue.path[0] ?? "form")] = issue.message;
  }
  return errors;
}

async function validCategorySlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const found = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  return found.map((category) => category.slug);
}

// ---------------------------------------------------------------------------
// Suggest an edit to an existing club
// ---------------------------------------------------------------------------

const EditInput = z.object({
  clubId: z.string().min(1),
  name: optionalText(200),
  description: optionalText(4000),
  websiteUrl: optionalUrl,
  contactEmail: optionalEmail,
  note: optionalText(1000),
  submitterEmail: optionalEmail,
});

export async function suggestClubEdit(
  _prev: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const parsed = EditInput.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    note: formData.get("note") ?? "",
    submitterEmail: formData.get("submitterEmail") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some of that needs fixing.",
      errors: collectIssues(parsed.error),
    };
  }

  const club = await prisma.club.findUnique({
    where: { id: parsed.data.clubId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      websiteUrl: true,
      contactEmail: true,
      socialLinks: true,
      categories: { select: { category: { select: { slug: true } } } },
    },
  });
  if (!club) return { ok: false, message: "That club no longer exists." };

  const { links: socialLinks, invalid } = parseSocialLinks(
    formData.get("socialLinks"),
  );
  if (invalid.length) {
    return {
      ok: false,
      errors: {
        socialLinks: `Couldn't read ${invalid.length === 1 ? "this link" : "these links"}: ${invalid.join(", ")}`,
      },
    };
  }

  const proposedCategories = await validCategorySlugs(
    formData.getAll("categories").map(String),
  );
  const currentCategories = club.categories.map((c) => c.category.slug);

  // Store only what actually differs. A field equal to the current value is not
  // a suggestion, and including it would pad the moderator's diff with noise.
  const same = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

  const changes = {
    name: parsed.data.name !== club.name ? parsed.data.name : undefined,
    description:
      parsed.data.description !== club.description
        ? parsed.data.description
        : undefined,
    websiteUrl:
      parsed.data.websiteUrl !== club.websiteUrl
        ? parsed.data.websiteUrl
        : undefined,
    contactEmail:
      parsed.data.contactEmail !== club.contactEmail
        ? parsed.data.contactEmail
        : undefined,
    socialLinks: same(socialLinks, club.socialLinks) ? [] : socialLinks,
    categorySlugs: same(proposedCategories, currentCategories)
      ? []
      : proposedCategories,
  };

  const hasChange =
    changes.name !== undefined ||
    changes.description !== undefined ||
    changes.websiteUrl !== undefined ||
    changes.contactEmail !== undefined ||
    changes.socialLinks.length > 0 ||
    changes.categorySlugs.length > 0;

  if (!hasChange) {
    return {
      ok: false,
      message:
        "Nothing looks different from what's already there — change a field before sending.",
    };
  }

  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.suggestEdit, hashedIp);
  if (!limit.ok) {
    return {
      ok: false,
      message:
        "That's a lot of suggestions at once. Try again in an hour — and thank you, genuinely.",
    };
  }

  await prisma.clubEditSuggestion.create({
    data: {
      clubId: club.id,
      ...changes,
      note: parsed.data.note,
      submitterEmail: parsed.data.submitterEmail,
      ipHash: hashedIp,
    },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Submit a club that isn't in the directory
// ---------------------------------------------------------------------------

const SubmissionInput = z.object({
  name: z
    .string()
    .trim()
    .min(2, "What's the club called?")
    .max(200, "That name is too long."),
  description: z
    .string()
    .trim()
    .min(
      40,
      "Please describe the club in at least 40 characters — enough for a moderator to know what it is.",
    )
    .max(4000),
  websiteUrl: optionalUrl,
  contactEmail: optionalEmail,
  note: optionalText(1000),
  submitterEmail: optionalEmail,
});

export async function submitNewClub(
  _prev: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const parsed = SubmissionInput.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    note: formData.get("note") ?? "",
    submitterEmail: formData.get("submitterEmail") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some of that needs fixing.",
      errors: collectIssues(parsed.error),
    };
  }

  const { links: socialLinks, invalid } = parseSocialLinks(
    formData.get("socialLinks"),
  );
  if (invalid.length) {
    return {
      ok: false,
      errors: {
        socialLinks: `Couldn't read ${invalid.length === 1 ? "this link" : "these links"}: ${invalid.join(", ")}`,
      },
    };
  }

  const categorySlugs = await validCategorySlugs(
    formData.getAll("categories").map(String),
  );
  if (categorySlugs.length === 0) {
    return { ok: false, errors: { categories: "Pick at least one category." } };
  }

  // Surface an existing match rather than queueing a duplicate. Checked against
  // name only — close enough to catch "we already have this" without pretending
  // to be clever about near-misses.
  const existing = await prisma.club.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } },
    select: { slug: true, name: true },
  });
  if (existing) {
    return {
      ok: false,
      message: `${existing.name} is already listed — you can review it or suggest an edit at /clubs/${existing.slug}.`,
    };
  }

  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.submitClub, hashedIp);
  if (!limit.ok) {
    return {
      ok: false,
      message: "That's several clubs in a short window. Try again a bit later.",
    };
  }

  await prisma.clubSubmission.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      websiteUrl: parsed.data.websiteUrl,
      contactEmail: parsed.data.contactEmail,
      socialLinks,
      categorySlugs,
      note: parsed.data.note,
      submitterEmail: parsed.data.submitterEmail,
      ipHash: hashedIp,
    },
  });

  return { ok: true };
}
