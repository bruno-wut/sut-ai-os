import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const { Client } = pg;

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");
const envFile = path.join(projectRoot, ".env.local");

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function readEnvValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  const envContents = await readFile(envFile, "utf8");
  const line = envContents
    .split(/\r?\n/u)
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    throw new Error(`${name} was not found in process env or .env.local`);
  }

  return stripQuotes(line.slice(line.indexOf("=") + 1).trim());
}

async function readLocalMigrations() {
  const filenames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  return filenames.map((filename) => {
    const match = filename.match(/^(?<version>\d+)_(?<name>.+)\.sql$/u);

    if (!match?.groups) {
      throw new Error(`Unexpected migration filename format: ${filename}`);
    }

    return {
      version: match.groups.version,
      name: match.groups.name,
      filename,
    };
  });
}

async function readRemoteMigrations(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const { rows } = await client.query(`
      select version, name
      from supabase_migrations.schema_migrations
      order by version;
    `);

    return rows;
  } finally {
    await client.end();
  }
}

function compareHistories(localMigrations, remoteMigrations) {
  const localByVersion = new Map(localMigrations.map(({ version, name }) => [version, name]));
  const remoteByVersion = new Map(remoteMigrations.map(({ version, name }) => [version, name]));

  const missingRemotely = localMigrations.filter(({ version }) => !remoteByVersion.has(version));
  const missingLocally = remoteMigrations.filter(({ version }) => !localByVersion.has(version));
  const mismatchedNames = localMigrations
    .filter(({ version }) => remoteByVersion.has(version))
    .filter(({ version, name }) => remoteByVersion.get(version) !== name)
    .map(({ version, name }) => ({
      version,
      localName: name,
      remoteName: remoteByVersion.get(version),
    }));

  return {
    missingLocally,
    missingRemotely,
    mismatchedNames,
  };
}

function findLegacySequenceGaps(migrations) {
  const legacyVersions = migrations
    .map(({ version }) => version)
    .filter((version) => /^\d{3}$/u.test(version))
    .map((version) => Number.parseInt(version, 10))
    .sort((left, right) => left - right);

  if (legacyVersions.length === 0) {
    return [];
  }

  const present = new Set(legacyVersions);
  const max = legacyVersions.at(-1);
  const gaps = [];

  for (let version = legacyVersions[0]; version <= max; version += 1) {
    if (!present.has(version)) {
      gaps.push(String(version).padStart(3, "0"));
    }
  }

  return gaps;
}

const localMigrations = await readLocalMigrations();
const connectionString = await readEnvValue("SUPABASE_DATABASE_URL");
const remoteMigrations = await readRemoteMigrations(connectionString);
const comparison = compareHistories(localMigrations, remoteMigrations);
const historiesAligned =
  comparison.missingLocally.length === 0 &&
  comparison.missingRemotely.length === 0 &&
  comparison.mismatchedNames.length === 0;
const legacySequenceGaps = findLegacySequenceGaps(localMigrations);
const latestMigration = localMigrations.at(-1);

if (!historiesAligned) {
  console.error(
    JSON.stringify(
      {
        status: "mismatch",
        localCount: localMigrations.length,
        remoteCount: remoteMigrations.length,
        missingLocally: comparison.missingLocally,
        missingRemotely: comparison.missingRemotely,
        mismatchedNames: comparison.mismatchedNames,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "aligned",
      localCount: localMigrations.length,
      remoteCount: remoteMigrations.length,
      latestMigration,
      legacySequenceGaps,
      note:
        legacySequenceGaps.length > 0
          ? "Legacy three-digit versions have intentional gaps. Do not backfill missing numbers with synthetic migrations."
          : "No legacy sequence gaps detected.",
    },
    null,
    2,
  ),
);
