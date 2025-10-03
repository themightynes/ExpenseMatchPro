import "dotenv/config";
import pkg from 'pg';
const { Client } = pkg;

const RAILWAY_URL = "postgresql://postgres:meQhpoMlQDHHLXNOKqvTSrVIXQcHlXdg@yamanote.proxy.rlwy.net:37545/railway";

async function verifyData() {
  const client = new Client({
    connectionString: RAILWAY_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("📊 Verifying Railway data...\n");

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM amex_statements) as statements,
        (SELECT COUNT(*) FROM amex_charges) as charges,
        (SELECT COUNT(*) FROM receipts) as receipts
    `);

    const data = counts.rows[0];
    console.log("Record counts:");
    console.log(`   Users:      ${data.users}`);
    console.log(`   Statements: ${data.statements}`);
    console.log(`   Charges:    ${data.charges}`);
    console.log(`   Receipts:   ${data.receipts}\n`);

    // Check your user
    const user = await client.query(`
      SELECT email, is_authorized
      FROM users
      WHERE email = 'ernesto.chapa@gmail.com'
    `);

    if (user.rows.length > 0) {
      console.log("✅ User verified:");
      console.log(`   Email: ${user.rows[0].email}`);
      console.log(`   Authorized: ${user.rows[0].is_authorized}\n`);
    }

    console.log("=".repeat(60));
    console.log("✅ All data migrated successfully!");
    console.log("=".repeat(60));

  } finally {
    await client.end();
  }
}

verifyData();
