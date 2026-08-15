/**
 * Category and tag vocabulary, plus the rules that assign interest categories.
 *
 * Two layers, deliberately:
 *
 *   SOURCE   — the 14 headings the directory groups clubs under. Authoritative
 *              and exhaustive: every club has exactly one, read straight from
 *              the page. No guessing.
 *
 *   INTEREST — cross-cutting areas we infer from the club's name and
 *              description. These exist because the source headings are too
 *              coarse for the questions people actually ask: every CS, finance
 *              and engineering club is filed under "Academic" or
 *              "Pre-Professional" together with debate societies and pre-law
 *              groups. Inferred, therefore fallible, and shown separately from
 *              the source headings so nobody mistakes one for the other.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CategorySeed = {
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
  kind: "SOURCE" | "INTEREST";
};

/**
 * The source's own headings, in its order. `heading` is matched verbatim
 * against the page, so if the directory renames one, seeding fails loudly
 * rather than silently dropping those clubs.
 */
export const SOURCE_CATEGORIES: Array<CategorySeed & { heading: string }> = [
  {
    heading: "Academic",
    slug: "academic",
    name: "Academic",
    emoji: "🔬",
    blurb: "Departmental societies, research groups, and subject clubs.",
    kind: "SOURCE",
  },
  {
    heading: "Athletics",
    slug: "athletics",
    name: "Athletics",
    emoji: "🏅",
    blurb: "Varsity teams, club sports, and recreation.",
    kind: "SOURCE",
  },
  {
    heading: "Cultural",
    slug: "cultural",
    name: "Cultural",
    emoji: "🌍",
    blurb: "National, regional, and heritage communities.",
    kind: "SOURCE",
  },
  {
    heading: "Fraternity and Sorority Life",
    slug: "greek",
    name: "Fraternity & Sorority Life",
    emoji: "🏛️",
    blurb: "Fraternities, sororities, and their governing councils.",
    kind: "SOURCE",
  },
  {
    heading: "Identity-Based",
    slug: "identity",
    name: "Identity-Based",
    emoji: "🤝",
    blurb: "Groups organized around shared identity and experience.",
    kind: "SOURCE",
  },
  {
    heading: "Media and Publications",
    slug: "media",
    name: "Media & Publications",
    emoji: "📰",
    blurb: "Newspapers, magazines, journals, radio, film, and TV.",
    kind: "SOURCE",
  },
  {
    heading: "Musical",
    slug: "musical",
    name: "Musical",
    emoji: "🎵",
    blurb: "Orchestras, a cappella, choirs, bands, and DJs.",
    kind: "SOURCE",
  },
  {
    heading: "Performing Arts",
    slug: "performing-arts",
    name: "Performing Arts",
    emoji: "🎭",
    blurb: "Theater, dance, comedy, and performance groups.",
    kind: "SOURCE",
  },
  {
    heading: "Politics, Activism and Advocacy",
    slug: "politics",
    name: "Politics, Activism & Advocacy",
    emoji: "📣",
    blurb: "Political groups, organizing, and issue advocacy.",
    kind: "SOURCE",
  },
  {
    heading: "Pre-Professional",
    slug: "pre-professional",
    name: "Pre-Professional",
    emoji: "💼",
    blurb: "Career-focused societies and professional development.",
    kind: "SOURCE",
  },
  {
    heading: "Religious/Spiritual",
    slug: "religious",
    name: "Religious & Spiritual",
    emoji: "🕊️",
    blurb: "Faith communities and religious life.",
    kind: "SOURCE",
  },
  {
    heading: "Service",
    slug: "service",
    name: "Service",
    emoji: "💟",
    blurb: "Volunteering, philanthropy, mentoring, and mutual aid.",
    kind: "SOURCE",
  },
  {
    heading: "Special Interest",
    slug: "special-interest",
    name: "Special Interest",
    emoji: "🌟",
    blurb: "Hobbies, games, food, and everything harder to categorize.",
    kind: "SOURCE",
  },
  {
    heading: "Student Government and Advisory Boards",
    slug: "student-government",
    name: "Student Government",
    emoji: "🗳️",
    blurb: "Councils, governing boards, and advisory bodies.",
    kind: "SOURCE",
  },
];

/** Cross-cutting interest areas, inferred. */
export const INTEREST_CATEGORIES: CategorySeed[] = [
  {
    slug: "cs",
    name: "Computer Science",
    emoji: "💻",
    blurb: "Software, hackathons, data, AI, and product.",
    kind: "INTEREST",
  },
  {
    slug: "engineering",
    name: "Engineering",
    emoji: "⚙️",
    blurb: "SEAS societies and hands-on build teams.",
    kind: "INTEREST",
  },
  {
    slug: "finance",
    name: "Finance & Consulting",
    emoji: "📈",
    blurb: "Investing, banking, consulting, and entrepreneurship.",
    kind: "INTEREST",
  },
  {
    slug: "law",
    name: "Law",
    emoji: "⚖️",
    blurb: "Pre-law societies, mock trial, and legal advocacy.",
    kind: "INTEREST",
  },
  {
    slug: "health",
    name: "Health",
    emoji: "🩺",
    blurb: "Pre-health societies, public health, and biomedical sciences.",
    kind: "INTEREST",
  },
  {
    slug: "environment",
    name: "Environment",
    emoji: "🌱",
    blurb: "Climate, conservation, and sustainability groups.",
    kind: "INTEREST",
  },
  {
    slug: "art",
    name: "Creativity",
    emoji: "🎨",
    blurb: "Art, fashion, and music groups.",
    kind: "INTEREST",
  },
];

/** Everything seeded into the Category table. `heading` is dropped — it's how
 *  we match the source page, not something the database needs. */
export const CATEGORIES: CategorySeed[] = [
  ...SOURCE_CATEGORIES.map((category): CategorySeed => ({
    slug: category.slug,
    name: category.name,
    emoji: category.emoji,
    blurb: category.blurb,
    kind: category.kind,
  })),
  ...INTEREST_CATEGORIES,
];

/**
 * Barnard's directory groups clubs under its own 7 headings rather than
 * Columbia's 14. Mapped onto the closest existing SOURCE slug rather than
 * given separate categories, so "Browse by category" stays one unified
 * 14-tile grid instead of doubling up with near-duplicate Barnard-only tiles
 * — a Barnard a cappella group and a Columbia one both belong under "Musical"
 * as far as a student browsing is concerned.
 */
export const BARNARD_HEADING_TO_SLUG = new Map([
  ["Cultural & International Clubs", "cultural"],
  ["Career & Professional Clubs", "pre-professional"],
  ["Impact & Volunteering Clubs", "service"],
  ["Performing Arts Clubs", "performing-arts"],
  ["Media Production & Writing Clubs", "media"],
  ["Self-Development & Interest-based Clubs", "special-interest"],
  ["Student Leadership Organizations", "student-government"],
]);

export const HEADING_TO_SLUG = new Map([
  ...SOURCE_CATEGORIES.map(
    (category): [string, string] => [category.heading, category.slug],
  ),
  ...BARNARD_HEADING_TO_SLUG,
]);

/**
 * Interest rules, matched against name + description.
 *
 * Because descriptions are available now, these match on real prose rather
 * than just a name, which makes them far more accurate than name-only matching
 * would be — but it also means a passing mention can trigger a false positive.
 * Patterns are therefore written to be specific ("investment banking", not
 * "bank"), and `data/overrides.json` removes the ones that still slip through.
 */
const INTEREST_RULES: Array<{ slug: string; patterns: RegExp[] }> = [
  {
    slug: "cs",
    patterns: [
      /\bcomputer science\b/i,
      /\bsoftware\b/i,
      /\bhackathon/i,
      // NOT a bare /programming/: in university prose "programming" almost
      // always means events, not code. It matched 12 unrelated clubs — a radio
      // station, three religious communities, a heritage month — before being
      // narrowed to these.
      /\bcomputer programming\b/i,
      /\bcompetitive programming\b/i,
      /\bprogramming language/i,
      /\bcoding\b/i,
      /\bdata science\b/i,
      /\bmachine learning\b/i,
      /\bartificial intelligence\b/i,
      /\bapp(lication)? develop/i,
      /\bweb develop/i,
      /\bcyber ?security\b/i,
      /\bblockchain\b/i,
      /\bquantum computing\b/i,
      /\bopen source\b/i,
      /\bdevelopers?\b/i,
      /\btech(nology)? (community|industry|club|group)\b/i,
    ],
  },
  {
    slug: "engineering",
    patterns: [
      /\bengineering\b/i,
      /\bengineers?\b/i,
      /\bseas\b/,
      /\brobotics?\b/i,
      /\brocket(ry)?\b/i,
      /\baeronautic/i,
      /\bastronautic/i,
      /\bformula sae\b/i,
      /\bmechanical\b/i,
      /\bcivil\b/i,
      /\bbiomedical\b/i,
      /\bmaterials science\b/i,
      /\bindustrial design\b/i,
    ],
  },
  {
    slug: "finance",
    patterns: [
      /\binvestment\b/i,
      /\binvesting\b/i,
      /\bfinance\b/i,
      /\bfinancial\b/i,
      /\bconsulting\b/i,
      /\bentrepreneur/i,
      /\bstartups?\b/i,
      /\bventure capital\b/i,
      /\bprivate equity\b/i,
      /\bcapital markets\b/i,
      /\btrading\b/i,
      /\bequity research\b/i,
      /\bbusiness (school|club|society|community)\b/i,
      /\baccounting\b/i,
      /\bwall street\b/i,
    ],
  },
  {
    slug: "law",
    patterns: [
      /\bpre-?law\b/i,
      /\bmock trial\b/i,
      /\blaw school\b/i,
      /\blegal\b/i,
      /\bmoot court\b/i,
      /\bconstitutional\b/i,
      /\bcivil rights\b/i,
      /\bjudicial\b/i,
    ],
  },
  {
    slug: "health",
    patterns: [
      /\bpre-?med(ical)?\b/i,
      /\bpre-?health\b/i,
      /\bpublic health\b/i,
      /\bmedical\b/i,
      /\bmedicine\b/i,
      /\bnursing\b/i,
      /\bmental health\b/i,
      /\bwellness\b/i,
      /\bhealthcare\b/i,
      /\bneuroscience\b/i,
      /\bemergency medical\b/i,
      /\bglobal health\b/i,
      /\bcancer\b/i,
      /\bbiolog\b/i,
    ],
  },
  {
    slug: "environment",
    patterns: [
      /\bsustainab/i,
      /\bclimate\b/i,
      /\benvironmental\b/i,
      /\bconservation\b/i,
      /\brenewable\b/i,
      /\bcarbon\b/i,
      /\bbiodiversity\b/i,
      /\becolog/i,
    ],
  },
  {
    slug: "art",
    patterns: [
      /\bartist/i,
      /\bmusic\b/i,
      /\bcreativ\b/i,
      /\bfashion\b/i,
    ],
  },
];

export type Overrides = {
  /** sourceId -> corrected display name. */
  displayNames: Record<string, string>;
  /** sourceId -> interest slugs to add on top of the inferred ones. */
  addInterests: Record<string, string[]>;
  /** sourceId -> interest slugs to strip (false positives). */
  removeInterests: Record<string, string[]>;
  /** sourceId -> curated tag slugs. */
  tags: Record<string, string[]>;
};

export const EMPTY_OVERRIDES: Overrides = {
  displayNames: {},
  addInterests: {},
  removeInterests: {},
  tags: {},
};

export async function loadOverrides(): Promise<Overrides> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "overrides.json"),
      "utf8",
    );
    return { ...EMPTY_OVERRIDES, ...JSON.parse(raw) };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

/**
 * Text the interest rules run against.
 *
 * Institutional names are stripped first. "Columbia Engineering" is what the
 * school is called, so it shows up in descriptions of clubs that have nothing
 * to do with engineering — the yearbook, a Catholic ministry, an advisory
 * council — purely because they mention which students they serve. Removing
 * the proper noun fixes the whole class of false positive at once instead of
 * one override per club.
 */
function haystackFor(name: string, description: string | null): string {
  return `${name}\n${description ?? ""}`
    .replace(/\bcolumbia engineering\b/gi, " ")
    .replace(/\bschool of engineering and applied science\b/gi, " ")
    .replace(/\bfu foundation\b/gi, " ")
    .replace(/\bcolumbia business school\b/gi, " ")
    .replace(/\bcolumbia law school\b/gi, " ");
}

/** Interest categories inferred from a club's name and description. */
export function inferInterests(name: string, description: string | null): string[] {
  const haystack = haystackFor(name, description);
  return INTEREST_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(haystack)),
  ).map((rule) => rule.slug);
}

/**
 * Which pattern caused a match, and the text it matched on. Used by
 * `classify:report` — matching against real descriptions means false positives
 * come from a single over-broad pattern hitting one incidental word, and
 * that's invisible unless the report says which word it was.
 */
export function explainInterest(
  slug: string,
  name: string,
  description: string | null,
): Array<{ pattern: string; matched: string }> {
  const haystack = haystackFor(name, description);
  const rule = INTEREST_RULES.find((r) => r.slug === slug);
  if (!rule) return [];
  return rule.patterns
    .map((pattern) => {
      const match = haystack.match(pattern);
      return match ? { pattern: String(pattern), matched: match[0] } : null;
    })
    .filter((hit): hit is { pattern: string; matched: string } => hit !== null);
}

/**
 * Full category list for a club: its source heading first (primary), then any
 * inferred interest areas, with overrides applied.
 */
export function categoriesFor(
  club: { sourceId: string; name: string; description: string | null; sourceCategories: string[] },
  overrides: Overrides,
): string[] {
  const source = club.sourceCategories
    .map((heading) => HEADING_TO_SLUG.get(heading))
    .filter((slug): slug is string => Boolean(slug));

  const remove = new Set(overrides.removeInterests[club.sourceId] ?? []);
  const interests = [
    ...inferInterests(club.name, club.description),
    ...(overrides.addInterests[club.sourceId] ?? []),
  ].filter((slug) => !remove.has(slug));

  return [...new Set([...source, ...interests])];
}

// Slug and sort-key helpers live in src/lib/slug.ts, because the admin approval
// flow creates clubs too and both paths must agree on how a slug is derived.
export { slugify, sortKey } from "../src/lib/slug";

export type TagSeed = {
  slug: string;
  label: string;
  group: string;
  description: string;
};

/**
 * Starter tag vocabulary. Deliberately small — the real set is still being
 * decided, and `Tag.group` is a plain string so adding groups later is a seed
 * change rather than a migration.
 */
export const TAGS: TagSeed[] = [
  // Getting in
  { slug: "highly-competitive", label: "Highly competitive", group: "Getting in", description: "Low acceptance rate." },
  { slug: "no-experience-needed", label: "No experience needed", group: "Getting in", description: "Beginners genuinely welcome." },

  // Commitment
  { slug: "heavy-commitment", label: "Heavy commitment", group: "Commitment", description: "10+ hours a week." },
  { slug: "light-commitment", label: "Light commitment", group: "Commitment", description: "A couple of hours a week or less." },
  { slug: "seasonal", label: "Seasonal", group: "Commitment", description: "Intense in bursts, quiet otherwise." },

  // Culture
  { slug: "tight-knit", label: "Tight-knit", group: "Culture", description: "People become close friends." },
  { slug: "welcoming", label: "Welcoming", group: "Culture", description: "Easy to feel included as a newcomer." },
  { slug: "cliquey", label: "Cliquey", group: "Culture", description: "Hard to break into existing circles." },
  { slug: "intense", label: "Intense", group: "Culture", description: "High-pressure, high-expectation environment." },
  { slug: "big-social-scene", label: "Big social scene", group: "Culture", description: "Parties, formals, mixers, etc." },

  // Payoff
  { slug: "recruiting-pipeline", label: "Recruiting pipeline", group: "Payoff", description: "Members reliably land internships through it." },
  { slug: "strong-alumni-network", label: "Strong alumni network", group: "Payoff", description: "Alumni actually help members." },
  { slug: "project-building", label: "Project building", group: "Payoff", description: "Members work on projects as part of the club's activities." },
  { slug: "skill-building", label: "Skill building", group: "Payoff", description: "Helps members develop valuable skills." },
  { slug: "guest-speakers", label: "Guest speakers", group: "Payoff", description: "Hosts events for members to learn from professionals." },
  { slug: "competitions", label: "Competitions", group: "Payoff", description: "Formally competes against other schools." },
  { slug: "networking-events", label: "Networking events", group: "Payoff", description: "Hosts summits, dinners, or other events where members can grow their professional network." },
  { slug: "mentorship", label: "Mentorship", group: "Payoff", description: "Upperclassmen mentor new members." },
  { slug: "fun-events", label: "Fun events", group: "Payoff", description: "Hosts fun events." },
  { slug: "free-food", label: "Free food", group: "Payoff", description: "Frequently caters food to events or meetings." },

];
