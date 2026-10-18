import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

/** libpq-only URL options that postgres-js would otherwise send to the server as settings (and fail). */
const LIBPQ_ONLY = ["channel_binding", "gssencmode", "target_session_attrs", "connect_timeout"];

/** Neon's connection strings include `channel_binding=require`; postgres-js can't take it. */
export function driverUrl(raw: string): string {
  const url = new URL(raw);
  for (const key of LIBPQ_ONLY) url.searchParams.delete(key);
  return url.toString();
}

function createDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set (see .env.example)");
  const url = driverUrl(raw);
  // prepare: false keeps us compatible with Neon's pooled (PgBouncer) endpoint.
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  return { db: drizzle(client, { schema }), client };
}

type Db = ReturnType<typeof createDb>;
const globalForDb = globalThis as unknown as { __frontierDb?: Db };

function instance(): Db {
  globalForDb.__frontierDb ??= createDb();
  return globalForDb.__frontierDb;
}

export function db() {
  return instance().db;
}

export async function closeDb() {
  if (globalForDb.__frontierDb) {
    await globalForDb.__frontierDb.client.end({ timeout: 5 });
    globalForDb.__frontierDb = undefined;
  }
}

export type Database = ReturnType<typeof db>;
