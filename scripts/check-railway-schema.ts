import "dotenv/config";
import pkg from 'pg';
const { Client } = pkg;

const RAILWAY_URL = "postgresql://postgres:meQhpoMlQDHHLXNOKqvTSrVIXQcHlXdg@yamanote.proxy.rlwy.net:37545/railway";

async function checkSchema() {
  const client = new Client({
    connectionString: RAILWAY_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log("\n📋 Users table columns:\n");
    result.rows.forEach((row: any) => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });

  } finally {
    await client.end();
  }
}

checkSchema();
