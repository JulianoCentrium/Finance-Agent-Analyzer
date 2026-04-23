#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function extractViewStatements(sql) {
  const statements = [];
  const re = /CREATE\s+OR\s+REPLACE\s+VIEW[\s\S]*?;\s*/gi;
  let m;
  while ((m = re.exec(sql)) !== null) statements.push(m[0]);
  return statements;
}

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    let count = 0;
    const files = await listMigrationFiles();
    for (const file of files) {
      const sql = await readFile(file, "utf-8");
      const stmts = extractViewStatements(sql);
      for (const stmt of stmts) {
        await client.query(stmt);
        count += 1;
      }
    }
    console.log(`Applied ${count} view definition(s) from ${files.length} migration file(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
