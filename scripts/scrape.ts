/**
 * Scrapes both schools' student-group directories: Columbia's undergraduate
 * directory and Barnard's.
 *
 * Columbia — undergrad.admissions.columbia.edu/life/here/clubs/listings:
 *   - 476 groups, undergrad-focused, on a single page (no pagination)
 *   - already grouped under 14 category headings, so the primary category is
 *     read from the source rather than guessed from the club's name
 *   - each row links to /studentgroup/<slug>, a real profile page carrying a
 *     description, a contact email, a website, and social links
 *
 * Unlike www.columbia.edu, this host does not sit behind an aggressive
 * Cloudflare rule — a burst of requests returns 200s. Requests are still
 * serialized-ish and delayed out of politeness, and detail fetches are
 * resumable so a re-run doesn't refetch what it already has.
 *
 * Barnard — barnard.edu/student-organizations — is a much thinner source:
 * ~85 clubs, one static page, grouped under its own 7 headings (mapped onto
 * the closest Columbia SOURCE slug in scripts/classify.ts), and there is no
 * per-club detail page at all — the listing gives exactly one link per club
 * (almost always a mailto, sometimes a social profile or external site), and
 * that link is the entire dataset. So there's no Barnard equivalent of the
 * Columbia detail-fetch phase: one request gets everything, every run.
 *
 * Usage:
 *   npm run scrape                  # both schools' listings + missing Columbia details
 *   npm run scrape -- --offline     # parse committed fixtures, no network
 *   npm run scrape -- --no-details  # listings only, no Columbia detail pages
 *   npm run scrape -- --limit 25    # fetch at most 25 Columbia detail pages this run
 *   npm run scrape -- --refresh     # refetch every Columbia detail page
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { BARNARD_HEADING_TO_SLUG } from "./classify";

const ORIGIN = "https://undergrad.admissions.columbia.edu";
const LISTING_URL = `${ORIGIN}/life/here/clubs/listings`;
const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "clubs.json");
const FIXTURE = path.join(DATA_DIR, "fixtures", "club-listings.html");

const BARNARD_ORIGIN = "https://barnard.edu";
const BARNARD_LISTING_URL = `${BARNARD_ORIGIN}/student-organizations`;
const BARNARD_FIXTURE = path.join(DATA_DIR, "fixtures", "barnard-listing.html");

const CONCURRENCY = 4;
const DELAY_MS = 250;
const RETRIES = 3;

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: LISTING_URL,
};

export type ScrapedClub = {
  school: "COLUMBIA" | "BARNARD";
  /** Slug from /studentgroup/<slug> for Columbia, `barnard:<slugified-name>`
   *  for Barnard (its directory has no per-club page to derive a stable id
   *  from). Stable, and our upsert key. */
  sourceId: string;
  name: string;
  /** Null for Barnard — see the file header. */
  sourcePath: string | null;
  /** Category headings this club appeared under on the listing page. */
  sourceCategories: string[];
  description: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  socialLinks: string[];
  /** Set once the detail page has been fetched, so re-runs skip it. Always
   *  null for Barnard, which has no detail phase. */
  detailFetchedAt: string | null;
};

type ClubsFile = {
  scrapedAt: string;
  source: string;
  barnardSource: string;
  count: number;
  categories: string[];
  clubs: ScrapedClub[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `${url}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

// --- HTML helpers -----------------------------------------------------------

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Minimal entity decoding — enough for the handful this source emits. */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function clean(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();
}

/**
 * Extracts the text of a Drupal field div by field name, handling the nested
 * markup (`<p>` inside body) that a naive non-greedy match would truncate.
 */
function fieldHtml(html: string, fieldName: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(
    `<div class="[^"]*field--name-${fieldName}[^"]*"[^>]*>`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    // Walk forward balancing <div> tags to find this field's closing tag.
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    const tag = /<\/?div\b[^>]*>/g;
    tag.lastIndex = i;
    let t: RegExpExecArray | null;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0].startsWith("</") ? -1 : 1;
      i = t.index;
    }
    results.push(html.slice(start, i));
  }
  return results;
}

function firstHref(html: string): string | null {
  const match = html.match(/href="([^"]+)"/);
  if (!match) return null;
  try {
    const url = new URL(match[1], ORIGIN);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// --- Listing ----------------------------------------------------------------

/**
 * Parses the listing into clubs keyed by slug. A club can appear under more
 * than one heading, so categories accumulate rather than overwrite.
 */
function parseListing(html: string): {
  clubs: Map<string, { name: string; sourcePath: string; categories: string[] }>;
  categories: string[];
} {
  const clubs = new Map<
    string,
    { name: string; sourcePath: string; categories: string[] }
  >();
  const categories: string[] = [];

  const groups = html.split(/<div class="views-group">/).slice(1);
  if (groups.length === 0) {
    throw new Error(
      "No `views-group` blocks found. Either Cloudflare served a challenge " +
        "page (retry, or use --offline) or the template changed.",
    );
  }

  for (const group of groups) {
    const headingMatch = group.match(
      /class="grouphead"[^>]*>([\s\S]*?)<\/h[1-6]>/,
    );
    const category = headingMatch ? clean(headingMatch[1]) : "Uncategorized";
    if (!categories.includes(category)) categories.push(category);

    const rowPattern =
      /views-field-title[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let row: RegExpExecArray | null;
    while ((row = rowPattern.exec(group))) {
      const sourcePath = row[1];
      const name = clean(row[2]);
      if (!name || !sourcePath.startsWith("/studentgroup/")) continue;
      const slug = sourcePath.replace(/^\/studentgroup\//, "").replace(/\/$/, "");

      const existing = clubs.get(slug);
      if (existing) {
        if (!existing.categories.includes(category)) {
          existing.categories.push(category);
        }
      } else {
        clubs.set(slug, { name, sourcePath, categories: [category] });
      }
    }
  }

  return { clubs, categories };
}

// --- Detail pages -----------------------------------------------------------

type Detail = {
  description: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  socialLinks: string[];
};

/**
 * Narrows to the club's own <article>. Necessary, not defensive: these pages
 * carry four separate `field--name-body` divs (sidebar and footer regions use
 * the same Drupal field), and the club's is not the first — reading the whole
 * document picks up the footer's social links as the club description.
 */
function studentGroupArticle(html: string): string {
  const start = html.search(
    /<article\b[^>]*class="[^"]*node--type-student-group[^"]*"[^>]*>/,
  );
  if (start === -1) return html;
  const end = html.indexOf("</article>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function parseDetail(fullHtml: string): Detail {
  const html = studentGroupArticle(fullHtml);
  const body = fieldHtml(html, "body")[0];
  // Keep paragraph breaks as newlines; collapse everything else.
  const description = body
    ? decodeEntities(
        body
          .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, ""),
      )
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim() || null
    : null;

  const contactRaw = fieldHtml(html, "field-student-group-contact")[0];
  const contactText = contactRaw ? clean(contactRaw) : "";
  // The contact field is free text; only keep it when it really is an address.
  const emailMatch = contactText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return {
    description,
    contactEmail: emailMatch ? emailMatch[0].toLowerCase() : null,
    websiteUrl: firstHref(fieldHtml(html, "field-student-group-website")[0] ?? ""),
    socialLinks: fieldHtml(html, "field-student-group-sociallink")
      .map((block) => firstHref(block))
      .filter((href): href is string => Boolean(href)),
  };
}

// --- Barnard ------------------------------------------------------------

const SOCIAL_HOST_PATTERN = /(^|\.)(facebook|instagram|twitter|x|tiktok)\.com$/i;

/**
 * Classifies a Barnard club's one and only link. Columbia's directory has
 * separate structured fields for contact/website/social; Barnard's listing
 * gives exactly one href per club (almost always a mailto, sometimes a
 * social profile or a generic site), so this has to infer which bucket it
 * belongs in rather than reading it off the source.
 */
function classifyBarnardHref(href: string): {
  contactEmail: string | null;
  websiteUrl: string | null;
  socialLinks: string[];
} {
  if (href.startsWith("mailto:")) {
    // A handful list two addresses comma-separated; keep the first.
    const email = href.slice("mailto:".length).split(",")[0].trim().toLowerCase();
    return { contactEmail: email || null, websiteUrl: null, socialLinks: [] };
  }
  try {
    const url = new URL(href, BARNARD_ORIGIN);
    if (SOCIAL_HOST_PATTERN.test(url.hostname.replace(/^www\./, ""))) {
      return { contactEmail: null, websiteUrl: null, socialLinks: [url.toString()] };
    }
    return { contactEmail: null, websiteUrl: url.toString(), socialLinks: [] };
  } catch {
    return { contactEmail: null, websiteUrl: null, socialLinks: [] };
  }
}

/**
 * Parses Barnard's directory. It's one static page, clubs grouped under 7
 * headings (`<div class="c--component c--chapter-default">` per heading —
 * that class string is the split delimiter, same technique as Columbia's
 * `views-group`), and there's no per-club detail page, so this single pass
 * over the listing is the entire dataset rather than just the index of it.
 */
function parseBarnardListing(html: string): {
  clubs: Map<string, { name: string; categories: string[]; href: string }>;
  categories: string[];
} {
  const clubs = new Map<
    string,
    { name: string; categories: string[]; href: string }
  >();
  const categories: string[] = [];

  const sections = html
    .split('class="c--component c--chapter-default"')
    .slice(1);
  if (sections.length === 0) {
    throw new Error(
      "No `c--component c--chapter-default` sections found on Barnard's " +
        "page. Either the fetch was blocked (retry, or use --offline) or " +
        "the template changed.",
    );
  }

  for (const section of sections) {
    const headingMatch = section.match(/<h2>([\s\S]*?)<\/h2>/);
    if (!headingMatch) continue;
    const heading = clean(headingMatch[1]);
    // The page opens with an intro section ("Find Your Squad") that shares
    // this same wrapper class and does have an <h2> — just not one of the 7
    // real categories — so BARNARD_HEADING_TO_SLUG (the single source of
    // truth for which headings are real, shared with classify.ts) is what
    // decides whether this section counts, not merely having a heading at all.
    if (!BARNARD_HEADING_TO_SLUG.has(heading)) continue;
    if (!categories.includes(heading)) categories.push(heading);

    const linkPattern = /<a\s+href="([^"]+)"\s+aria-label="([^"]+)">/g;
    let link: RegExpExecArray | null;
    while ((link = linkPattern.exec(section))) {
      const href = decodeEntities(link[1]);
      const name = decodeEntities(link[2]).trim();
      if (!name) continue;
      const slug = `barnard:${slugify(name)}`;

      const existing = clubs.get(slug);
      if (existing) {
        if (!existing.categories.includes(heading)) existing.categories.push(heading);
      } else {
        clubs.set(slug, { name, categories: [heading], href });
      }
    }
  }

  return { clubs, categories };
}

async function getBarnardHtml(): Promise<string> {
  if (flag("offline")) {
    process.stdout.write("Reading committed Barnard fixture (--offline)…\n");
    return readFile(BARNARD_FIXTURE, "utf8");
  }
  process.stdout.write("Fetching Barnard listing…\n");
  const res = await fetchWithRetry(BARNARD_LISTING_URL);
  const html = await res.text();
  await mkdir(path.dirname(BARNARD_FIXTURE), { recursive: true });
  await writeFile(BARNARD_FIXTURE, html);
  return html;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
        await sleep(DELAY_MS);
      }
    }),
  );
}

// --- Main -------------------------------------------------------------------

async function readExisting(): Promise<Map<string, ScrapedClub>> {
  try {
    const file: ClubsFile = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return new Map(file.clubs.map((club) => [club.sourceId, club]));
  } catch {
    return new Map();
  }
}

async function getListingHtml(): Promise<string> {
  if (flag("offline")) {
    process.stdout.write("Reading committed fixture (--offline)…\n");
    return readFile(FIXTURE, "utf8");
  }
  process.stdout.write("Fetching listing…\n");
  const res = await fetchWithRetry(LISTING_URL);
  const html = await res.text();
  await mkdir(path.dirname(FIXTURE), { recursive: true });
  await writeFile(FIXTURE, html);
  return html;
}

async function main() {
  const html = await getListingHtml();
  const { clubs: listed, categories } = parseListing(html);
  process.stdout.write(
    `Found ${listed.size} clubs across ${categories.length} categories.\n`,
  );

  const previous = await readExisting();
  const clubs: ScrapedClub[] = [...listed.entries()].map(([slug, entry]) => {
    const prior = previous.get(slug);
    return {
      school: "COLUMBIA" as const,
      sourceId: slug,
      name: entry.name,
      sourcePath: entry.sourcePath,
      sourceCategories: entry.categories,
      description: prior?.description ?? null,
      contactEmail: prior?.contactEmail ?? null,
      websiteUrl: prior?.websiteUrl ?? null,
      socialLinks: prior?.socialLinks ?? [],
      detailFetchedAt: flag("refresh") ? null : (prior?.detailFetchedAt ?? null),
    };
  });

  if (!flag("no-details") && !flag("offline")) {
    const limit = Number(option("limit") ?? Infinity);
    const pending = clubs.filter((c) => !c.detailFetchedAt).slice(0, limit);

    if (pending.length === 0) {
      process.stdout.write("All detail pages already fetched.\n");
    } else {
      process.stdout.write(
        `Fetching ${pending.length} detail page${pending.length === 1 ? "" : "s"}…\n`,
      );
      let done = 0;
      let failed = 0;
      await mapPool(pending, CONCURRENCY, async (club) => {
        try {
          // Non-null: this loop only ever runs over Columbia entries, which
          // always have a sourcePath (Barnard's, always null, are appended
          // after this phase finishes — see below).
          const res = await fetchWithRetry(ORIGIN + club.sourcePath!);
          const detail = parseDetail(await res.text());
          Object.assign(club, detail);
          club.detailFetchedAt = new Date().toISOString();
        } catch {
          // Mark attempted so a re-run moves on rather than retrying forever.
          club.detailFetchedAt = new Date().toISOString();
          failed++;
        }
        done++;
        if (done % 20 === 0 || done === pending.length) {
          process.stdout.write(`\r  ${done}/${pending.length}`);
        }
      });
      process.stdout.write(`\n${failed ? `  ${failed} failed\n` : ""}`);
    }
  }

  // Barnard has no detail phase — one fetch, one parse, done — so it's
  // appended after Columbia's detail-fetch loop rather than threaded through
  // it, keeping that loop's `ORIGIN + sourcePath` logic Columbia-only.
  const barnardHtml = await getBarnardHtml();
  const { clubs: barnardListed, categories: barnardCategories } =
    parseBarnardListing(barnardHtml);
  process.stdout.write(`Found ${barnardListed.size} Barnard clubs.\n`);

  for (const [slug, entry] of barnardListed) {
    const prior = previous.get(slug);
    const fresh = classifyBarnardHref(entry.href);
    clubs.push({
      school: "BARNARD",
      sourceId: slug,
      name: entry.name,
      sourcePath: null,
      sourceCategories: entry.categories,
      description: prior?.description ?? null,
      contactEmail: fresh.contactEmail,
      websiteUrl: fresh.websiteUrl,
      socialLinks: fresh.socialLinks,
      detailFetchedAt: null,
    });
  }
  for (const heading of barnardCategories) {
    if (!categories.includes(heading)) categories.push(heading);
  }

  await mkdir(DATA_DIR, { recursive: true });
  const payload: ClubsFile = {
    scrapedAt: new Date().toISOString(),
    source: LISTING_URL,
    barnardSource: BARNARD_LISTING_URL,
    count: clubs.length,
    categories,
    clubs,
  };
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + "\n");

  const withDescription = clubs.filter((c) => c.description).length;
  const withWebsite = clubs.filter((c) => c.websiteUrl).length;
  const withEmail = clubs.filter((c) => c.contactEmail).length;
  const columbiaCount = clubs.filter((c) => c.school === "COLUMBIA").length;
  const barnardCount = clubs.filter((c) => c.school === "BARNARD").length;
  process.stdout.write(
    `\nWrote ${clubs.length} clubs to ${path.relative(process.cwd(), OUT_FILE)}\n` +
      `  ${columbiaCount} Columbia, ${barnardCount} Barnard\n` +
      `  ${withDescription} with a description\n` +
      `  ${withWebsite} with a website\n` +
      `  ${withEmail} with a contact email\n`,
  );
}

main().catch((err) => {
  console.error(`\nScrape failed: ${err.message}`);
  process.exit(1);
});
