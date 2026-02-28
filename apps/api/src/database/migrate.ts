import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../config/database';

async function migrate() {
  console.log('🔄 Running database migration...');

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    if (!pool) {
      throw new Error('Database pool is not initialized');
    }
    await pool.query(schema);
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

migrate();
