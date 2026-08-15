/**
 * The rating vocabulary — every dimension's label, prompt, evaluative flag,
 * and scale words, plus the how-to-join options. All of it lives in this one
 * file on purpose: this is the thing to edit if the rating categories ever
 * need to change again. A dimension's scale can be any length — the form, the
 * bars, and the review-card pips all read `scale.length` rather than
 * assuming 5, so adding a dimension or changing a scale's point count is a
 * data change here, not a change to every component that renders one.
 * (Organization used to be a 3-point scale; it's 5 now, and that was a
 * one-line change to the array below, nothing else.)
 *
 * Every dimension but Commitment is evaluative (higher is better). Commitment
 * is not: a 5 means "time sink", which is a fact about the club, not a
 * judgment — the same treatment `ratingSelectivity` used to get before it
 * was replaced by the how-to-join checkboxes below. Descriptive dimensions
 * are never averaged into anything that implies "more is better", and the UI
 * gives them a neutral color and no "/5".
 *
 * "Recommend" is what used to be the standalone yes/no `gladJoined` question
 * — it's a 1–5 scale like everything else now, so it's just another
 * dimension here rather than a special-cased boolean field/UI section.
 */

export type RatingKey =
  | "professional"
  | "community"
  | "commitment"
  | "organization"
  | "recommend";

export type RatingDimension = {
  key: RatingKey;
  /**
   * Prisma field on Review. "professional"/"community" map to
   * `ratingProfessional`/`ratingSocial` rather than fields of their own —
   * those columns already meant almost exactly this before the rewording
   * ("professional reward", "social reward"), so keeping the names avoided
   * a rename-only migration for two of the four original dimensions.
   */
  field:
    | "ratingProfessional"
    | "ratingSocial"
    | "ratingCommitment"
    | "ratingOrganization"
    | "ratingRecommend";
  label: string;
  /** Shown under the label on the review form. */
  prompt: string;
  /** false for commitment — see the file-level note above. */
  evaluative: boolean;
  /** One word per scale point, index 0 = rating 1. Length varies. */
  scale: readonly string[];
};

export const RATING_DIMENSIONS: RatingDimension[] = [
  {
    key: "professional",
    field: "ratingProfessional",
    label: "Professional development",
    prompt: "How much did it help your career, skills, or applications?",
    evaluative: true,
    scale: [
      "Frolic fest",
      "Attempts to help",
      "Somewhat helpful",
      "Very helpful",
      "Landed me an internship",
    ],
  },
  {
    key: "community",
    field: "ratingSocial",
    label: "Community",
    prompt: "Did you find community and friends here?",
    evaluative: true,
    scale: [
      "Meetings are silent",
      "Barely made friends",
      "Made a few friends",
      "Made many friends",
      "Made my best friends",
    ],
  },
  {
    key: "organization",
    field: "ratingOrganization",
    label: "Organization",
    prompt: "How well was it actually run?",
    evaluative: true,
    scale: [
      "Barely active",
      "Poorly organized",
      "Decently organized",
      "Very organized",
      "Amazingly run",
    ],
  },
  {
    key: "commitment",
    field: "ratingCommitment",
    label: "Commitment",
    prompt: "How much time and energy did it actually take?",
    evaluative: false,
    scale: [
      "Come as you please",
      "Low commitment",
      "Moderate commitment",
      "High commitment",
      "Time sink",
    ],
  },
  {
    key: "recommend",
    field: "ratingRecommend",
    label: "Would recommend?",
    prompt: "Would you recommend this organization to others?",
    evaluative: true,
    scale: [
      "Stay far away",
      "Not really",
      "Maybe",
      "Yes",
      "Best thing I've done",
    ],
  },
];

export const DIMENSION_BY_KEY = Object.fromEntries(
  RATING_DIMENSIONS.map((d) => [d.key, d]),
) as Record<RatingKey, RatingDimension>;

/** Word for a (possibly averaged) value, rounding to the nearest step. */
export function scaleWord(key: RatingKey, value: number | null): string | null {
  if (value == null) return null;
  const dim = DIMENSION_BY_KEY[key];
  const max = dim.scale.length - 1;
  const index = Math.min(max, Math.max(0, Math.round(value) - 1));
  return dim.scale[index];
}

/**
 * How to join — multi-select, not a rating, so it isn't in RATING_DIMENSIONS
 * above. Stored as `Review.howToJoin: String[]` of these slugs rather than a
 * Prisma enum, so adding another option is a line in this array, not a
 * migration.
 *
 * "other" is the one slug with special handling elsewhere (ReviewForm,
 * ReviewCard): checking it reveals a free-text field, stored separately in
 * `Review.howToJoinOther` since a slug array has nowhere to put prose.
 */
export const HOW_TO_JOIN_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "just-show-up", label: "Just show up" },
  { slug: "application", label: "Written application required" },
  { slug: "interview", label: "Interview required" },
  { slug: "tryouts-audition", label: "Tryouts/audition required" },
  { slug: "other", label: "Other" },
];

export const HOW_TO_JOIN_OTHER_SLUG = "other";

export const HOW_TO_JOIN_LABEL_BY_SLUG = Object.fromEntries(
  HOW_TO_JOIN_OPTIONS.map((o) => [o.slug, o.label]),
) as Record<string, string>;

export const AFFILIATION_LABELS: Record<string, string> = {
  COLUMBIA_CC: "Columbia College",
  COLUMBIA_SEAS: "SEAS",
  COLUMBIA_GS: "General Studies",
  BARNARD: "Barnard",
  GRADUATE: "Graduate student",
  OTHER: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  CURRENT_MEMBER: "Current member",
  FORMER_MEMBER: "Former member",
  BOARD_MEMBER: "Board member",
};

export const FLAG_REASON_LABELS: Record<string, string> = {
  HARASSMENT: "Harassment or abuse",
  IDENTIFYING_INFO: "Identifies a specific person",
  SPAM: "Spam or advertising",
  OFF_TOPIC: "Not about this club",
  FACTUALLY_WRONG: "Factually wrong",
  OTHER: "Something else",
};

export const MIN_BODY_LENGTH = 40;
export const MAX_BODY_LENGTH = 5000;
