"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIpHash, LIMITS } from "@/lib/ratelimit";

/**
 * Site feedback: a bug report or a suggestion, not tied to any club. Same
 * moderator-gated, no-email-verification shape as the club contribution
 * forms in src/app/contribute/actions.ts — see the doc comment on
 * SiteFeedback in schema.prisma for why that's the right model here too.
 */

export type FeedbackFormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "That doesn't look like an email address.",
  });

const FeedbackInput = z.object({
  kind: z.enum(["BUG", "SUGGESTION"], { message: "Pick bug or suggestion." }),
  message: z
    .string()
    .trim()
    .min(
      10,
      "A few more words would help — what happened, or what you'd change?",
    )
    .max(2000, "That's longer than the maximum of 2,000 characters."),
  contactEmail: optionalEmail,
  pageUrl: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export async function submitFeedback(
  _prev: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const parsed = FeedbackInput.safeParse({
    kind: formData.get("kind"),
    message: formData.get("message") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    pageUrl: formData.get("pageUrl") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return { ok: false, message: "Some of that needs fixing.", errors };
  }

  const hashedIp = await clientIpHash();
  const limit = await checkRateLimit(LIMITS.feedback, hashedIp);
  if (!limit.ok) {
    return {
      ok: false,
      message: "That's a lot of feedback at once. Try again in a bit.",
    };
  }

  await prisma.siteFeedback.create({
    data: {
      kind: parsed.data.kind,
      message: parsed.data.message,
      contactEmail: parsed.data.contactEmail,
      pageUrl: parsed.data.pageUrl,
      ipHash: hashedIp,
    },
  });

  return { ok: true };
}
