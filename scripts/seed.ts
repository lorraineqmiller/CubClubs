/**
 * Seeds categories, tags, and the scraped clubs.
 *
 * Idempotent: safe to re-run after a scrape or an overrides.json edit. Club
 * rows are keyed on the source slug, so renames update in place.
 *
 *   npm run seed          # taxonomy + clubs
 *   npm run seed:demo     # ...plus example reviews, for local development
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Affiliation, MemberRole } from "../src/generated/prisma/enums";
import {
  CATEGORIES,
  HEADING_TO_SLUG,
  TAGS,
  categoriesFor,
  loadOverrides,
  slugify,
  sortKey,
} from "./classify";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const withDemo = process.argv.includes("--demo");

type ClubsFile = {
  scrapedAt: string;
  categories: string[];
  clubs: Array<{
    school: "COLUMBIA" | "BARNARD";
    sourceId: string;
    name: string;
    sourcePath: string | null;
    sourceCategories: string[];
    description: string | null;
    contactEmail: string | null;
    websiteUrl: string | null;
    socialLinks: string[];
  }>;
};

async function seedTaxonomy() {
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, sortOrder: index },
      update: { ...category, sortOrder: index },
    });
  }
  for (const [index, tag] of TAGS.entries()) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: { ...tag, sortOrder: index },
      update: { ...tag, sortOrder: index },
    });
  }

  // Drop categories that are no longer in CATEGORIES. Without this, renaming a
  // category leaves the old row behind forever, showing up in the UI with a
  // count of zero — which is how "Arts & Performance 0" survived the switch to
  // a new source. Safe to delete outright: club↔category links are fully
  // derived and rebuilt on every seed, so nothing user-authored is lost.
  //
  // Tags deliberately get no equivalent cleanup: reviewers attach tags to their
  // reviews, so deleting a removed tag would take real review content with it.
  // A retired tag has to be migrated by hand.
  const removed = await prisma.category.deleteMany({
    where: { slug: { notIn: CATEGORIES.map((category) => category.slug) } },
  });

  console.log(
    `  ${CATEGORIES.length} categories, ${TAGS.length} tags` +
      (removed.count ? `, ${removed.count} stale category/-ies removed` : ""),
  );
}

async function seedClubs() {
  const file: ClubsFile = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "clubs.json"), "utf8"),
  );
  const overrides = await loadOverrides();

  // A renamed heading would silently drop every club under it, so fail loudly.
  const unknown = file.categories.filter((h) => !HEADING_TO_SLUG.has(h));
  if (unknown.length) {
    throw new Error(
      `Unrecognized source headings: ${unknown.join(", ")}. Add them to ` +
        `SOURCE_CATEGORIES in scripts/classify.ts.`,
    );
  }

  // Prune before inserting, not after: a delisted club still occupies its slug,
  // and a new club that slugifies the same way would fail the unique index.
  await pruneDelisted(file.clubs.map((club) => club.sourceId));

  const categoryIds = new Map(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id]),
  );
  const tagIds = new Map((await prisma.tag.findMany()).map((t) => [t.slug, t.id]));

  let created = 0;
  let updated = 0;
  let skippedJointClubs = 0;
  // Seeded with what's already in the database, so a collision with a club we
  // aren't touching this run is caught too rather than blowing up on insert.
  const usedSlugs = new Map<string, string>(
    (await prisma.club.findMany({ select: { slug: true, sourceId: true } })).map(
      (club) => [club.slug, club.sourceId],
    ),
  );

  // Barnard's directory deliberately cross-lists clubs that are jointly
  // Columbia-Barnard (Bach Society, Philolexian Society, CU Players — Barnard
  // students can join Columbia clubs and vice versa) rather than only clubs
  // exclusive to Barnard. There's no shared id between the two directories to
  // detect this with, so an exact name match is the signal: Columbia's clubs
  // are processed first (they come first in `file.clubs`), so by the time a
  // same-named Barnard entry is reached it's recognized as the same real club
  // rather than seeded as a second, review-splitting page for it.
  const seenNames = new Map<string, string>();

  for (const raw of file.clubs) {
    const name = overrides.displayNames[raw.sourceId] ?? raw.name;

    if (raw.school === "BARNARD" && seenNames.has(name.toLowerCase())) {
      skippedJointClubs++;
      continue;
    }

    // Men's/women's variants of a sport slugify identically ("Fencing (Men's)"
    // and "Fencing (Women's)" both lose the parenthetical), so fall back to the
    // source slug rather than letting one overwrite the other.
    let slug = slugify(name);
    const owner = usedSlugs.get(slug);
    if ((owner && owner !== raw.sourceId) || !slug) slug = raw.sourceId;
    usedSlugs.set(slug, raw.sourceId);

    const cats = categoriesFor(raw, overrides);
    const missing = cats.filter((c) => !categoryIds.has(c));
    if (missing.length) {
      throw new Error(
        `Club ${raw.sourceId} (${name}) references unknown categories: ` +
          `${missing.join(", ")}. Add them to scripts/classify.ts.`,
      );
    }

    const existing = await prisma.club.findUnique({
      where: { sourceId: raw.sourceId },
      select: { id: true, editedFields: true },
    });

    // Fields a moderator has accepted a community correction for. The directory
    // does not get to win those back — otherwise the next scrape silently
    // reverts every approved fix.
    const edited = new Set(existing?.editedFields ?? []);
    const keep = <T,>(field: string, value: T) =>
      edited.has(field) ? {} : value;

    const club = await prisma.club.upsert({
      where: { sourceId: raw.sourceId },
      create: {
        sourceId: raw.sourceId,
        school: raw.school,
        slug,
        name,
        sortName: sortKey(name),
        description: raw.description,
        contactEmail: raw.contactEmail,
        websiteUrl: raw.websiteUrl,
        socialLinks: raw.socialLinks,
        sourcePath: raw.sourcePath,
      },
      update: {
        slug,
        // Not moderator-editable, so no reason for this to ever diverge from
        // the source — just keep it in sync unconditionally.
        school: raw.school,
        ...keep("name", { name, sortName: sortKey(name) }),
        // Don't clobber existing detail with nulls from a partial re-scrape.
        ...keep(
          "description",
          raw.description ? { description: raw.description } : {},
        ),
        ...keep(
          "contactEmail",
          raw.contactEmail ? { contactEmail: raw.contactEmail } : {},
        ),
        ...keep(
          "websiteUrl",
          raw.websiteUrl ? { websiteUrl: raw.websiteUrl } : {},
        ),
        ...keep(
          "socialLinks",
          raw.socialLinks.length ? { socialLinks: raw.socialLinks } : {},
        ),
        sourcePath: raw.sourcePath,
      },
    });
    if (existing) updated++;
    else created++;
    seenNames.set(name.toLowerCase(), raw.sourceId);

    // Categories are fully derived, so replace them wholesale — that way
    // removing a rule actually removes the assignment. The source heading comes
    // first in `cats`, which makes it the primary one. Left alone entirely once
    // a moderator has approved a category change.
    if (!edited.has("categories")) {
      await prisma.clubCategory.deleteMany({ where: { clubId: club.id } });
      await prisma.clubCategory.createMany({
        data: cats.map((categorySlug, i) => ({
          clubId: club.id,
          categoryId: categoryIds.get(categorySlug)!,
          isPrimary: i === 0,
        })),
      });
    }

    for (const tagSlug of overrides.tags[raw.sourceId] ?? []) {
      const tagId = tagIds.get(tagSlug);
      if (!tagId) {
        throw new Error(
          `Club ${raw.sourceId} references unknown tag "${tagSlug}". Add it to ` +
            `TAGS in scripts/classify.ts.`,
        );
      }
      await prisma.clubTag.upsert({
        where: { clubId_tagId: { clubId: club.id, tagId } },
        create: { clubId: club.id, tagId, source: "CURATED" },
        update: { source: "CURATED" },
      });
    }
  }

  console.log(
    `  ${created} clubs created, ${updated} updated` +
      (skippedJointClubs
        ? `, ${skippedJointClubs} Barnard entries skipped as joint clubs already listed`
        : ""),
  );
}

/**
 * Clubs in the database but no longer in the directory.
 *
 * Not deleted by default: a club disappearing from the source is usually a
 * directory edit, not grounds for destroying the reviews people wrote about it.
 * `--prune` opts in, and the review count is reported first so the cost of the
 * decision is visible rather than silent.
 */
async function pruneDelisted(currentSourceIds: string[]) {
  const stale = await prisma.club.findMany({
    where: {
      sourceId: { notIn: currentSourceIds },
      // Community clubs are never in clubs.json by definition, so without this
      // filter `--prune` would delete every student-submitted club on the next
      // seed. This is load-bearing, not defensive.
      origin: "DIRECTORY",
    },
    select: { id: true, reviewCount: true },
  });
  if (stale.length === 0) return;

  const attachedReviews = stale.reduce((sum, club) => sum + club.reviewCount, 0);
  if (!process.argv.includes("--prune")) {
    console.log(
      `  ${stale.length} club(s) in the database are no longer in the directory ` +
        `(${attachedReviews} review(s) attached).\n` +
        `    Left in place — re-run with --prune to delete them. Note that they ` +
        `still hold their slugs,\n    so a new club with the same name will be ` +
        `given a fallback slug.`,
    );
    return;
  }
  await prisma.club.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  console.log(
    `  pruned ${stale.length} delisted club(s) and ${attachedReviews} attached review(s)`,
  );
}

/**
 * Example reviews so the UI has something to render locally. Guarded against
 * production because fabricated reviews on a real review site would be
 * indefensible.
 */
const DEMO_REVIEWS: Array<{
  clubSlug: string;
  body: string;
  ratingProfessional: number;
  ratingSocial: number;
  ratingCommitment: number;
  ratingOrganization: number;
  ratingRecommend: number;
  howToJoin: string[];
  howToJoinOther?: string;
  affiliation: Affiliation;
  role: MemberRole;
  year: number;
  tags: string[];
}> = [
  {
    clubSlug: "application-development-initiative",
    body: "ADI is the closest thing Columbia has to a real tech community and it costs you nothing to show up. DevFest and Hackathon are genuinely well run, and the workshops assume you know nothing, which I appreciated as someone who took Intro to CS as a junior. The flip side is that it's loose — there's no roster, no obligation, and if you want mentorship you have to go ask for it rather than wait for it. Do that and the upperclassmen are generous with their time.",
    ratingProfessional: 5,
    ratingSocial: 4,
    ratingCommitment: 2,
    ratingOrganization: 3,
    ratingRecommend: 4,
    howToJoin: ["just-show-up"],
    affiliation: "COLUMBIA_SEAS",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["skill-building", "no-experience-needed", "recruiting-pipeline"],
  },
  {
    clubSlug: "columbia-organization-of-rising-entrepreneurs-core",
    body: "Joined sophomore fall with no startup experience and it was the most useful thing I did here. Pitch nights force you to get comfortable being wrong in front of people. Downside: leadership turns over every year and the quality swings with it — my second year was noticeably less organized than my first. Come for the network, not the programming.",
    ratingProfessional: 5,
    ratingSocial: 3,
    ratingCommitment: 2,
    ratingOrganization: 2,
    ratingRecommend: 4,
    howToJoin: ["just-show-up"],
    affiliation: "COLUMBIA_CC",
    role: "FORMER_MEMBER",
    year: 2025,
    tags: ["strong-alumni-network", "networking-events", "light-commitment"],
  },
  {
    clubSlug: "columbia-financial-investment-group-cfig",
    body: "The stock pitch training is real and the alumni in banking do pick up the phone. But be honest with yourself about what you're joining: recruitment is a numbers game, the culture is competitive in a way that isn't always friendly, and if you're not gunning for IB or PE you will feel out of place by November. I got the internship I wanted. I did not make friends.",
    ratingProfessional: 5,
    ratingSocial: 2,
    ratingCommitment: 4,
    ratingOrganization: 4,
    ratingRecommend: 2,
    howToJoin: ["interview"],
    affiliation: "COLUMBIA_CC",
    role: "FORMER_MEMBER",
    year: 2025,
    tags: ["highly-competitive", "recruiting-pipeline", "intense", "cliquey"],
  },
  {
    clubSlug: "society-of-women-engineers",
    body: "SWE is the reason I stayed in engineering. The mentorship pairing is real — my mentor read three of my cover letters and got me an interview. Conference travel is partly funded, which matters if you're on aid. Meetings can feel like a lot of logistics talk, and if you're not looking for the professional side you might find it dry.",
    ratingProfessional: 5,
    ratingSocial: 4,
    ratingCommitment: 3,
    ratingOrganization: 4,
    ratingRecommend: 5,
    howToJoin: ["just-show-up"],
    affiliation: "COLUMBIA_SEAS",
    role: "BOARD_MEMBER",
    year: 2025,
    tags: ["recruiting-pipeline", "welcoming", "mentorship"],
  },
  {
    clubSlug: "blue-and-white",
    body: "Writing for the magazine taught me more about prose than any class in the English department. Editors actually edit — expect your draft back bleeding. It's a real time sink during production weeks and the social scene is fairly insular; a lot of people already knew each other from Lit Hum. Worth it if you want to write, less so if you want a résumé line.",
    ratingProfessional: 3,
    ratingSocial: 3,
    ratingCommitment: 4,
    ratingOrganization: 4,
    ratingRecommend: 4,
    howToJoin: ["application"],
    affiliation: "COLUMBIA_CC",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["skill-building", "cliquey", "seasonal"],
  },
  {
    clubSlug: "philolexian-society",
    body: "Absurd in the best way. It's a debate society that mostly debates nonsense, and the humor is very particular — you'll know within one meeting whether it's for you. No barrier to entry, no commitment, and the oldest continuously running student org here, which they will remind you of constantly.",
    ratingProfessional: 1,
    ratingSocial: 4,
    ratingCommitment: 1,
    ratingOrganization: 3,
    ratingRecommend: 4,
    howToJoin: ["just-show-up"],
    affiliation: "COLUMBIA_GS",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["light-commitment", "welcoming", "fun-events"],
  },
  {
    clubSlug: "columbia-university-ems",
    body: "The EMT certification alone is worth it and they train you properly. Shifts are long, overnight, and occasionally genuinely traumatic — nobody sugarcoats that in recruitment but you should know going in. Tight-knit in the way that only shared 3am calls produce. If you're pre-med and looking for clinical hours that aren't shadowing, this is the one.",
    ratingProfessional: 5,
    ratingSocial: 5,
    ratingCommitment: 5,
    ratingOrganization: 5,
    ratingRecommend: 5,
    howToJoin: ["interview"],
    affiliation: "COLUMBIA_CC",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["heavy-commitment", "tight-knit", "skill-building"],
  },
  {
    clubSlug: "robotics",
    body: "Great if you want to actually build something instead of reading about it. Competition season is a crunch and the machine shop hours are brutal in February. Be warned that a handful of people do most of the CAD and the rest hold parts — that's on you to push past, not something anyone will fix for you.",
    ratingProfessional: 4,
    ratingSocial: 3,
    ratingCommitment: 4,
    ratingOrganization: 2,
    ratingRecommend: 4,
    howToJoin: ["just-show-up"],
    affiliation: "COLUMBIA_SEAS",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["skill-building", "seasonal", "heavy-commitment", "no-experience-needed"],
  },
  {
    clubSlug: "cu-pep-band",
    body: "They mean it about all skill levels — I hadn't touched a trumpet since sophomore year of high school and nobody blinked. Because it started in 2022 it still feels like it's being figured out, which cuts both ways: you can shape things, but scheduling is sometimes chaotic and you'll find out about a game two days ahead. Football and basketball games are genuinely fun and you get in free. Zero career value, obviously, and I'd join again anyway.",
    ratingProfessional: 1,
    ratingSocial: 5,
    ratingCommitment: 3,
    ratingOrganization: 1,
    ratingRecommend: 5,
    howToJoin: ["just-show-up"],
    affiliation: "BARNARD",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["no-experience-needed", "tight-knit", "fun-events", "welcoming"],
  },
  {
    clubSlug: "columbia-undergraduate-consulting-club",
    body: "Casing practice is well structured and the case books are worth the membership on their own. It's also enormous, so how much you get out of it depends entirely on whether you show up to small-group sessions rather than just the speaker events. Skewed heavily sophomore-and-up; as a first-year I mostly listened.",
    ratingProfessional: 4,
    ratingSocial: 3,
    ratingCommitment: 3,
    ratingOrganization: 3,
    ratingRecommend: 2,
    howToJoin: ["application"],
    affiliation: "COLUMBIA_CC",
    role: "CURRENT_MEMBER",
    year: 2026,
    tags: ["recruiting-pipeline", "guest-speakers"],
  },
];

async function seedDemoReviews() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo reviews with NODE_ENV=production.");
  }
  const tagIds = new Map((await prisma.tag.findMany()).map((t) => [t.slug, t.id]));
  let inserted = 0;
  const missing: string[] = [];

  for (const demo of DEMO_REVIEWS) {
    const club = await prisma.club.findUnique({
      where: { slug: demo.clubSlug },
      select: { id: true },
    });
    if (!club) {
      missing.push(demo.clubSlug);
      continue;
    }
    // No posterKey to upsert on any more (reviews carry no identity at all),
    // so idempotency across repeated `seed:demo` runs is keyed on the exact
    // body text instead — unique per DEMO_REVIEWS entry.
    const existing = await prisma.review.findFirst({
      where: { clubId: club.id, body: demo.body },
      select: { id: true },
    });
    if (existing) {
      inserted++;
      continue;
    }

    const publishedAt = new Date(
      Date.UTC(demo.year, (inserted * 3) % 12, 1 + (inserted % 27)),
    );
    await prisma.review.create({
      data: {
        clubId: club.id,
        body: demo.body,
        ratingProfessional: demo.ratingProfessional,
        ratingSocial: demo.ratingSocial,
        ratingCommitment: demo.ratingCommitment,
        ratingOrganization: demo.ratingOrganization,
        ratingRecommend: demo.ratingRecommend,
        howToJoin: demo.howToJoin,
        howToJoinOther: demo.howToJoinOther,
        affiliation: demo.affiliation,
        role: demo.role,
        yearInvolved: demo.year,
        status: "APPROVED",
        publishedAt,
        createdAt: publishedAt,
        agreeCount: (inserted * 5) % 15,
        disagreeCount: (inserted * 2) % 5,
        tags: {
          create: demo.tags
            .filter((slug) => tagIds.has(slug))
            .map((slug) => ({ tagId: tagIds.get(slug)! })),
        },
      },
    });
    inserted++;
  }

  const { recomputeClubAggregates, recomputeClubTagCounts } = await import(
    "../src/lib/aggregates"
  );
  const touched = await prisma.club.findMany({
    where: { reviews: { some: {} } },
    select: { id: true },
  });
  for (const club of touched) {
    await recomputeClubAggregates(club.id);
    await recomputeClubTagCounts(club.id);
  }

  console.log(`  ${inserted} demo reviews across ${touched.length} clubs`);
  if (missing.length) {
    console.log(`  note: no club matched ${missing.join(", ")} — slug changed?`);
  }
}

async function main() {
  console.log("Seeding taxonomy…");
  await seedTaxonomy();
  console.log("Seeding clubs…");
  await seedClubs();
  if (withDemo) {
    console.log("Seeding demo reviews…");
    await seedDemoReviews();
  }
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
