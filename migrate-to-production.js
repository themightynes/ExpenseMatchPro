#!/usr/bin/env node

/**
 * Development to Production Database Migration Script
 * 
 * This script migrates all data from development to production database
 * Usage: node migrate-to-production.js
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './shared/schema.js';

// Environment setup
const DEV_DATABASE_URL = process.env.DATABASE_URL; // Current development DB
const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL; // Will be set when production DB is created

async function migrateData() {
  console.log('🚀 Starting Development to Production Migration...');
  
  if (!DEV_DATABASE_URL) {
    throw new Error('DATABASE_URL (development) is required');
  }
  
  if (!PROD_DATABASE_URL) {
    throw new Error('PROD_DATABASE_URL (production) is required');
  }
  
  // Create connections
  const devPool = new Pool({ connectionString: DEV_DATABASE_URL });
  const prodPool = new Pool({ connectionString: PROD_DATABASE_URL });
  
  const devDb = drizzle({ client: devPool, schema });
  const prodDb = drizzle({ client: prodPool, schema });
  
  try {
    console.log('📊 Checking development data...');
    
    // Get counts from development
    const devUsers = await devDb.select().from(schema.users);
    const devStatements = await devDb.select().from(schema.amexStatements);
    const devCharges = await devDb.select().from(schema.amexCharges);
    const devReceipts = await devDb.select().from(schema.receipts);
    
    console.log(`Found in development:
    - Users: ${devUsers.length}
    - Statements: ${devStatements.length} 
    - Charges: ${devCharges.length}
    - Receipts: ${devReceipts.length}`);
    
    // Migrate in correct order (respecting foreign keys)
    console.log('🔄 Migrating users...');
    if (devUsers.length > 0) {
      await prodDb.insert(schema.users).values(devUsers).onConflictDoNothing();
    }
    
    console.log('🔄 Migrating AMEX statements...');
    if (devStatements.length > 0) {
      await prodDb.insert(schema.amexStatements).values(devStatements).onConflictDoNothing();
    }
    
    console.log('🔄 Migrating AMEX charges...');
    if (devCharges.length > 0) {
      await prodDb.insert(schema.amexCharges).values(devCharges).onConflictDoNothing();
    }
    
    console.log('🔄 Migrating receipts...');
    if (devReceipts.length > 0) {
      await prodDb.insert(schema.receipts).values(devReceipts).onConflictDoNothing();
    }
    
    // Verify migration
    console.log('✅ Verifying production data...');
    const prodUserCount = await prodDb.select().from(schema.users);
    const prodStatementCount = await prodDb.select().from(schema.amexStatements);
    const prodChargeCount = await prodDb.select().from(schema.amexCharges);
    const prodReceiptCount = await prodDb.select().from(schema.receipts);
    
    console.log(`Production database now contains:
    - Users: ${prodUserCount.length}
    - Statements: ${prodStatementCount.length}
    - Charges: ${prodChargeCount.length}
    - Receipts: ${prodReceiptCount.length}`);
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData().catch(console.error);
}

export { migrateData };