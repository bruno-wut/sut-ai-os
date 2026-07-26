import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");
const testsDirectory = path.join(projectRoot, "supabase", "tests");
const database = await PGlite.create({ extensions: { pgcrypto } });
const baseline010Compatibility = process.argv.includes("--baseline-010");

const prelude = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create schema extensions;
  create table auth.users (
    id uuid primary key default gen_random_uuid()
  );
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

await database.exec(prelude);

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .filter(
    (name) =>
      !baseline010Compatibility ||
      Number.parseInt(name.slice(0, 3), 10) <= 10 ||
      name.startsWith("012_"),
  )
  .sort();

for (const filename of migrationFiles) {
  const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
  try {
    await database.exec(sql);
    console.log(`✓ migration ${filename}`);
  } catch (error) {
    console.error(`✗ migration ${filename}`);
    throw error;
  }
}

const testFiles = (await readdir(testsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .filter((name) => !baseline010Compatibility || name.startsWith("012_"))
  .sort();

for (const filename of testFiles) {
  const sql = await readFile(path.join(testsDirectory, filename), "utf8");
  try {
    await database.exec(sql);
    console.log(`✓ database test ${filename}`);
  } catch (error) {
    console.error(`✗ database test ${filename}`);
    throw error;
  }
}

await database.close();
