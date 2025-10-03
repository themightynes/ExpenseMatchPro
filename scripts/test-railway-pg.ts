import "dotenv/config";
import pkg from 'pg';
const { Client } = pkg;

const railwayUrl = process.env.RAILWAY_DATABASE_URL || process.argv[2];

if (!railwayUrl) {
  console.error("❌ No database URL provided!");
  process.exit(1);
}

async function testConnection() {
  console.log("🔌 Testing Railway database connection...\n");

  const client = new Client({
    connectionString: railwayUrl,
    ssl: {
      rejectUnauthorized: false // Railway requires SSL
    }
  });

  try {
    console.log("1️⃣ Connecting...");
    await client.connect();
    console.log("   ✅ Connected!\n");

    // Test query
    console.log("2️⃣ Testing query...");
    const result = await client.query('SELECT version()');
    console.log(`   ✅ PostgreSQL ${result.rows[0].version.split(' ')[1]}\n`);

    // Check tables
    console.log("3️⃣ Checking tables...");
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log("   ⚠️  No tables found\n");
      console.log("📝 Next step: Run 'npm run db:push' to create schema");
    } else {
      console.log(`   ✅ Found ${tables.rows.length} tables:`);
      tables.rows.forEach((t: any) => console.log(`      - ${t.table_name}`));
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Railway database is ready!");
    console.log("=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ Connection failed!");
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
