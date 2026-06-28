import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres.js detects Cloudflare Workers and uses cloudflare:sockets for TCP.
// prepare: false required for Supabase Supavisor transaction mode.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });

// Convenience: generate a unique ID for new records.
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
