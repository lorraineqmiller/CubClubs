/**
 * Slug and sort-key derivation.
 *
 * Lives in src/lib rather than scripts/ because both the seed and the admin
 * approval flow create clubs, and two copies of a slug function is how you end
 * up with two clubs that disagree about their own URL.
 */

/**
 * Slugs that would collide with a real route under /clubs/. Next resolves the
 * static segment first, so a club with one of these slugs would be permanently
 * unreachable — it would silently render the wrong page instead.
 */
export const RESERVED_SLUGS = new Set(["new"]);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Alphabetical sort key. 84 of the 476 directory clubs start with "Columbia",
 * so sorting on the raw name buries a fifth of the list under C; strip that
 * prefix and a leading article. Display always uses the untouched name.
 */
export function sortKey(name: string): string {
  return name
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/^columbia\s+(university\s+)?/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Finds a free slug, appending -2, -3, … on collision.
 *
 * `isTaken` is injected rather than querying here so this stays usable from
 * both a script holding its own Prisma client and a server action.
 */
export async function uniqueSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback?: string,
): Promise<string> {
  const base = slugify(name) || slugify(fallback ?? "") || "club";
  if (!RESERVED_SLUGS.has(base) && !(await isTaken(base))) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!RESERVED_SLUGS.has(candidate) && !(await isTaken(candidate))) {
      return candidate;
    }
  }
  // 99 clubs with the same name is not a real scenario; failing loudly beats
  // looping forever or silently overwriting one of them.
  throw new Error(`Could not find a free slug for "${name}".`);
}
