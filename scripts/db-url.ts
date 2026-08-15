/**
 * Syncs DATABASE_URL / SHADOW_DATABASE_URL in .env from the running
 * `prisma dev` local Postgres server.
 *
 * `prisma dev` picks fresh ports on every start, so hardcoding a connection
 * string in .env breaks the next time you restart it. This reads the server's
 * own state file instead. In production DATABASE_URL points at a real hosted
 * Postgres and this script is never used.
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import path from "node:path";

const SERVER_NAME = process.env.PRISMA_DEV_NAME ?? "cubclubs";

/** Where `prisma dev` keeps per-server state, per OS. */
function stateDir(): string {
  if (platform() === "darwin") {
    return path.join(
      homedir(),
      "Library",
      "Application Support",
      "prisma-dev-nodejs",
    );
  }
  if (platform() === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"),
      "prisma-dev-nodejs",
    );
  }
  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share"),
    "prisma-dev-nodejs",
  );
}

type ServerState = {
  exports: {
    database: { connectionString: string };
    shadowDatabase: { connectionString: string };
  };
};

/** Replace or append a KEY="value" line without disturbing the rest of .env. */
function upsertEnv(contents: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return contents.replace(/\n*$/, "\n") + line + "\n";
}

async function main() {
  const statePath = path.join(stateDir(), SERVER_NAME, "server.json");
  let state: ServerState;
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    console.error(
      `No running local database named "${SERVER_NAME}".\n` +
        `Start one in another terminal with:\n\n  npx prisma dev --name ${SERVER_NAME}\n`,
    );
    process.exit(1);
  }

  const envPath = path.join(process.cwd(), ".env");
  let env = "";
  try {
    env = await readFile(envPath, "utf8");
  } catch {
    // No .env yet; we'll create one.
  }

  env = upsertEnv(env, "DATABASE_URL", state.exports.database.connectionString);
  env = upsertEnv(
    env,
    "SHADOW_DATABASE_URL",
    state.exports.shadowDatabase.connectionString,
  );
  await writeFile(envPath, env);

  console.log(`Updated .env from local database "${SERVER_NAME}".`);
  console.log(`  ${state.exports.database.connectionString}`);
}

main();
