// drizzle.config.ts
// Source: orm.drizzle.team/docs/connect-turso
//
// ⚠️  WARNING: DO NOT use `bunx drizzle-kit push` in this project.
//
// This project uses a custom migration for the FTS5 virtual table (listings_fts)
// and its three sync triggers (listings_ai, listings_ad, listings_au).
// `drizzle-kit push` compares the current schema to the database and drops any
// tables it doesn't recognise — including virtual tables defined outside schema.ts.
// Running `push` will silently destroy the FTS5 index and all full-text search.
//
// ALWAYS use:
//   bunx drizzle-kit generate   # generate migration from schema changes
//   bunx drizzle-kit migrate    # apply pending migrations to the database
//
// Local dev: TURSO_DATABASE_URL=file:./dev.db (no auth token needed)
// Production: TURSO_DATABASE_URL=libsql://<db>.turso.io (auth token required)
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
