/**
 * Sort vocabulary shared by the server query layer and the client filter UI.
 *
 * Kept out of lib/clubs.ts on purpose: that module imports the Prisma client,
 * and a client component importing anything from it drags the Postgres driver
 * into the browser bundle (which fails to build on `require('dns')`).
 *
 * "Highest rated"/"Hardest to get into"/"Easiest to join" are gone — they
 * were tied to `avgOverall`/`avgSelectivity`, both retired along with the
 * old 1-5 overall score and difficulty scale (see the rating-system rewrite
 * in src/lib/ratings.ts). "Best professionally"/"Most fun" sort on the same
 * two dimensions the club-card badge already shows, rather than a blended
 * score nobody actually rated.
 */

export type SortKey =
  | "relevance"
  | "best-professionally"
  | "most-fun"
  | "most-reviewed"
  | "name";

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "A–Z" },
  { key: "best-professionally", label: "Best professionally" },
  { key: "most-fun", label: "Most fun" },
  { key: "most-reviewed", label: "Most reviewed" },
];

export const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.key));

export function parseSort(value: string | undefined): SortKey {
  return value && VALID_SORTS.has(value) ? (value as SortKey) : "name";
}
