import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import pkg from 'pg';
const { Client } = pkg;

const RAILWAY_URL = "postgresql://postgres:meQhpoMlQDHHLXNOKqvTSrVIXQcHlXdg@yamanote.proxy.rlwy.net:37545/railway";

async function importData() {
  console.log("📦 Importing data to Railway...\n");

  const client = new Client({
    connectionString: RAILWAY_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to Railway\n");

    // Import users
    console.log("1️⃣ Importing users...");
    const usersData = JSON.parse(await fs.readFile("users.json", "utf-8"));

    for (const user of usersData) {
      await client.query(`
        INSERT INTO users (
          id, email, name, "googleId", "profilePicture", "isAuthorized",
          "createdAt", "lastLoginAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          "googleId" = EXCLUDED."googleId",
          "profilePicture" = EXCLUDED."profilePicture",
          "isAuthorized" = EXCLUDED."isAuthorized",
          "lastLoginAt" = EXCLUDED."lastLoginAt"
      `, [
        user.id,
        user.email,
        user.name,
        user.google_id,
        user.profile_picture,
        user.is_authorized,
        user.created_at,
        user.last_login_at,
        new Date() // updatedAt
      ]);
    }
    console.log(`   ✅ Imported ${usersData.length} users\n`);

    // Import amexStatements first (foreign key dependency)
    try {
      console.log("2️⃣ Importing statements...");
      const statementsData = JSON.parse(await fs.readFile("amex_statements.json", "utf-8"));

      for (const statement of statementsData) {
        await client.query(`
          INSERT INTO "amexStatements" (
            id, "periodName", "startDate", "endDate", "isActive", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [
          statement.id,
          statement.period_name,
          statement.start_date,
          statement.end_date,
          statement.is_active,
          statement.created_at,
          statement.updated_at
        ]);
      }
      console.log(`   ✅ Imported ${statementsData.length} statements\n`);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        console.log("   ⏭️  amex_statements.json not found, skipping\n");
      } else {
        throw e;
      }
    }

    // Import receipts
    try {
      console.log("3️⃣ Importing receipts...");
      const receiptsData = JSON.parse(await fs.readFile("receipts.json", "utf-8"));

      for (const receipt of receiptsData) {
        await client.query(`
          INSERT INTO receipts (
            id, "fileName", "originalFileName", "fileUrl", merchant, amount, date,
            category, "processingStatus", "statementId", "isMatched", "matchedChargeId",
            notes, "fromAddress", "organizedPath", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING
        `, [
          receipt.id,
          receipt.file_name,
          receipt.original_file_name,
          receipt.file_url,
          receipt.merchant,
          receipt.amount,
          receipt.date,
          receipt.category,
          receipt.processing_status,
          receipt.statement_id,
          receipt.is_matched,
          receipt.matched_charge_id,
          receipt.notes,
          receipt.from_address,
          receipt.organized_path,
          receipt.created_at,
          receipt.updated_at
        ]);
      }
      console.log(`   ✅ Imported ${receiptsData.length} receipts\n`);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        console.log("   ⏭️  receipts.json not found, skipping\n");
      } else {
        throw e;
      }
    }

    // Import amexCharges
    try {
      console.log("4️⃣ Importing charges...");
      const chargesData = JSON.parse(await fs.readFile("amex_charges.json", "utf-8"));

      for (const charge of chargesData) {
        await client.query(`
          INSERT INTO "amexCharges" (
            id, date, "statementId", description, "cardMember", "accountNumber",
            amount, "extendedDetails", "statementAs", address, "cityState", "zipCode",
            country, reference, category, "isMatched", "receiptId", "isPersonalExpense",
            "noReceiptRequired", "isNonAmex", "userNotes", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (id) DO NOTHING
        `, [
          charge.id,
          charge.date,
          charge.statement_id,
          charge.description,
          charge.card_member,
          charge.account_number,
          charge.amount,
          charge.extended_details,
          charge.statement_as,
          charge.address,
          charge.city_state,
          charge.zip_code,
          charge.country,
          charge.reference,
          charge.category,
          charge.is_matched,
          charge.receipt_id,
          charge.is_personal_expense,
          charge.no_receipt_required,
          charge.is_non_amex,
          charge.user_notes,
          charge.created_at,
          charge.updated_at
        ]);
      }
      console.log(`   ✅ Imported ${chargesData.length} charges\n`);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        console.log("   ⏭️  charges.json not found, skipping\n");
      } else {
        throw e;
      }
    }

    console.log("=".repeat(60));
    console.log("✅ Import complete!");
    console.log("=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ Import failed:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

importData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
