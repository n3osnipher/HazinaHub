import { Pool } from 'pg';
import dotenv from 'dotenv';
import { mockQuery, mockGetClient } from './mockDatabase';

dotenv.config();

let useMock = false;
let pool: Pool | null = null;

// Try to connect to PostgreSQL, fallback to mock
try {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'hazinahub',
    user: process.env.DB_USER || 'hazinahub',
    password: process.env.DB_PASSWORD || 'your_secure_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });

  pool.on('error', () => {
    if (!useMock) {
      console.log('⚠️ PostgreSQL connection lost, switching to mock mode');
      useMock = true;
    }
  });

  // Test connection immediately
  pool.query('SELECT 1').then(() => {
    console.log('✅ Connected to PostgreSQL');
  }).catch(() => {
    console.log('⚠️ PostgreSQL unavailable — switching to MOCK MODE');
    useMock = true;
  });
} catch {
  console.log('⚠️ PostgreSQL unavailable — using MOCK MODE');
  useMock = true;
}

export const query = async (text: string, params?: unknown[]): Promise<any> => {
  if (useMock) {
    return mockQuery(text, params);
  }
  try {
    return await pool!.query(text, params);
  } catch (err) {
    // If PostgreSQL fails mid-operation, fallback to mock
    console.log('⚠️ PostgreSQL query failed, falling back to mock mode');
    useMock = true;
    return mockQuery(text, params);
  }
};

export const getClient = async (): Promise<any> => {
  if (useMock) {
    return mockGetClient();
  }
  return pool!.connect();
};

export default pool;
