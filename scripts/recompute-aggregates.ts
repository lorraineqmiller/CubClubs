// One-off fixup: recalculates every club's denormalized rating aggregates and
// tag counts from whatever Review rows actually exist right now.
//
// Needed after any direct deletion of Review rows (e.g. via Prisma Studio or
// raw SQL) — those bypass the app's own moderation actions, which are the only
// place recomputeClubAggregates()/recomputeClubTagCounts() normally get
// called. Safe to re-run any time; it's idempotent.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { recomputeClubAggregates, recomputeClubTagCounts } from "@/lib/aggregates";

async function main() {
  const clubs = await prisma.club.findMany({ select: { id: true, name: true } });
  console.log(`Recomputing aggregates for ${clubs.length} clubs...`);

  for (const club of clubs) {
    await recomputeClubAggregates(club.id);
    await recomputeClubTagCounts(club.id);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
