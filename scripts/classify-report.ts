/**
 * Dry-run the category assignment and print what it would do. No database.
 * Run this after editing interest rules or overrides:
 *   npm run classify:report
 *   npm run classify:report -- cs      # just one interest category, with why
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CATEGORIES,
  HEADING_TO_SLUG,
  INTEREST_CATEGORIES,
  SOURCE_CATEGORIES,
  categoriesFor,
  explainInterest,
  loadOverrides,
} from "./classify";

type ClubsFile = {
  categories: string[];
  clubs: Array<{
    sourceId: string;
    name: string;
    description: string | null;
    sourceCategories: string[];
  }>;
};

async function main() {
  const file: ClubsFile = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "clubs.json"), "utf8"),
  );
  const overrides = await loadOverrides();
  const focus = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

  // Catch a renamed heading immediately rather than silently losing its clubs.
  const unknownHeadings = file.categories.filter((h) => !HEADING_TO_SLUG.has(h));
  if (unknownHeadings.length) {
    console.log(
      `\n!! Unrecognized source headings: ${unknownHeadings.join(", ")}\n` +
        `   Add them to SOURCE_CATEGORIES in scripts/classify.ts.\n`,
    );
  }

  const counts = new Map(CATEGORIES.map((c) => [c.slug, 0]));
  const byInterest = new Map<string, string[]>(
    INTEREST_CATEGORIES.map((c) => [c.slug, []]),
  );

  for (const club of file.clubs) {
    const slugs = categoriesFor(club, overrides);
    for (const slug of slugs) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      byInterest.get(slug)?.push(club.name);
    }
  }

  if (focus) {
    const names = byInterest.get(focus);
    if (!names) {
      console.log(
        `No interest category "${focus}". Options: ${INTEREST_CATEGORIES.map((c) => c.slug).join(", ")}`,
      );
      return;
    }
    console.log(`\n=== ${focus}: ${names.length} clubs ===\n`);
    for (const name of names) {
      const club = file.clubs.find((c) => c.name === name)!;
      const why = explainInterest(focus, club.name, club.description)
        .map((hit) => `${hit.pattern} → "${hit.matched}"`)
        .join(", ");
      const forced = (overrides.addInterests[club.sourceId] ?? []).includes(focus);
      console.log(`  ${name}  [${club.sourceCategories[0] ?? "?"}]`);
      console.log(`     ${why || (forced ? "(added by override)" : "(no pattern?)")}`);
    }
    return;
  }

  console.log(`\n=== ${file.clubs.length} clubs ===`);

  console.log(`\n--- source categories (from the directory) ---\n`);
  for (const category of SOURCE_CATEGORIES) {
    console.log(
      `${String(counts.get(category.slug)).padStart(4)}  ${category.slug}`,
    );
  }

  console.log(`\n--- interest categories (inferred) ---\n`);
  for (const category of INTEREST_CATEGORIES) {
    console.log(
      `${String(counts.get(category.slug)).padStart(4)}  ${category.slug}`,
    );
  }

  const noInterest = file.clubs.filter(
    (club) =>
      categoriesFor(club, overrides).filter((slug) =>
        INTEREST_CATEGORIES.some((c) => c.slug === slug),
      ).length === 0,
  );
  console.log(
    `\n${noInterest.length} clubs have no interest category (expected — most clubs aren't career tracks).\n` +
      `Run \`npm run classify:report -- <slug>\` to review one category's members.\n`,
  );
}

main();
