/**
 * src/db/migrate.ts
 *
 * Database migration runner for AI Bazaar.
 *
 * Runs Drizzle migrations AND applies FTS5 triggers that drizzle-kit's turso
 * dialect migration runner cannot handle (the BEGIN...END trigger syntax is
 * not correctly executed by drizzle-kit's SQL statement splitter).
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/db/migrate.ts
 *
 * In production (Turso cloud):
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun src/db/migrate.ts
 */

import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Error: TURSO_DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

async function main() {
  console.log('Running Drizzle migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Schema migrations applied.');

  // Apply FTS5 triggers directly — drizzle-kit's turso dialect runner does not
  // correctly execute multi-statement SQL containing SQLite BEGIN...END blocks.
  // Each trigger is applied as a separate statement via the libSQL client.
  console.log('Applying FTS5 sync triggers...');

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS listings_ai AFTER INSERT ON listings BEGIN
      INSERT INTO listings_fts(rowid, name, tagline, description, tags)
      VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
    END
  `);

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS listings_ad AFTER DELETE ON listings BEGIN
      INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
      VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
    END
  `);

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS listings_au AFTER UPDATE ON listings BEGIN
      INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
      VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
      INSERT INTO listings_fts(rowid, name, tagline, description, tags)
      VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
    END
  `);

  console.log('FTS5 triggers applied (listings_ai, listings_ad, listings_au).');
  console.log('Migration complete.');
  client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
