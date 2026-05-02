import "dotenv/config";
import { beforeAll, beforeEach } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set for tests");
}

process.env.DATABASE_URL = url;

const migrationClient = postgres(url, { max: 1 });
const migrationDb = drizzle(migrationClient);

beforeAll(async () => {
  await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(migrationDb, { migrationsFolder: "./migrations" });
});

beforeEach(async () => {
  await migrationDb.execute(sql`TRUNCATE TABLE encounters RESTART IDENTITY CASCADE`);
});
