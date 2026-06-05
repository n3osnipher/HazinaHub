import pool from '../config/database';

async function verifySchema() {
  try {
    console.log('Verifying users table schema...');
    if (!pool) throw new Error('Pool not initialized');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log('Columns:');
    result.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
  } catch (error) {
    console.error('Failed to verify schema:', error);
  } finally {
    if (pool) pool.end();
  }
}

verifySchema();
