// src/db/client.ts
// Source: orm.drizzle.team/docs/tutorials/drizzle-with-turso
//
// Single Drizzle client instance for the AI Bazaar application.
//
// This module is imported by CatalogService and SearchService — never instantiate
// a second Drizzle client elsewhere. Module-level singletons are cached by the
// Bun/Node module system, so this file is only evaluated once per process.
//
// Local dev:  TURSO_DATABASE_URL=file:./dev.db (authToken not needed)
// Production: TURSO_DATABASE_URL=libsql://<db>.turso.io, TURSO_AUTH_TOKEN=<token>
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Drizzle ORM client connected to the libSQL/Turso database.
 *
 * Import this as `db` everywhere database access is needed:
 * ```ts
 * import { db } from '@/db/client';
 * ```
 */
export const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN, // optional for local SQLite file
  },
  schema,
});
