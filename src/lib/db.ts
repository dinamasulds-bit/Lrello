import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// CF Workers: max:1 (one connection per worker instance via cloudflare:sockets).
// prepare:false required for Supabase connection pooler.
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });

// Convenience: generate a unique ID for new records.
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
