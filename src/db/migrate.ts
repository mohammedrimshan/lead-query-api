import 'dotenv/config';
import { sql } from './client';
import { SCHEMA_SQL } from './schema';

async function migrate() {
  console.log('Running migrations...');
  await sql.unsafe(SCHEMA_SQL);
  console.log('✅ Migrations complete');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
