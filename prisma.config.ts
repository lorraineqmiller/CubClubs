import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run seed` after `prisma migrate reset`.
    seed: "tsx scripts/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Only set locally (see scripts/db-url.ts); hosted Postgres providers
    // create their own shadow database.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
