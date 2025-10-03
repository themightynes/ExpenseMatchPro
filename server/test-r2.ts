/**
 * Simple R2 Connection Test
 *
 * Run this to verify your R2 configuration is working:
 * npx tsx server/test-r2.ts
 */

import 'dotenv/config';
import { R2StorageService, shouldUseR2 } from './r2Storage';

async function testR2Connection() {
  console.log('\n🧪 Testing Cloudflare R2 Connection...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('- R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
  console.log('- R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
  console.log('- R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  console.log('- R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? '✅ Set' : '❌ Missing');
  console.log();

  if (!shouldUseR2()) {
    console.log('❌ R2 configuration incomplete. Set all R2_* environment variables.\n');
    process.exit(1);
  }

  try {
    // Initialize R2 service
    console.log('📦 Initializing R2 service...');
    const r2 = new R2StorageService();
    console.log('✅ R2 service initialized\n');

    // Test upload
    console.log('📤 Testing file upload...');
    const testContent = Buffer.from('Hello from R2 test! 🚀', 'utf-8');
    const objectPath = await r2.uploadFile(testContent, 'test-file.txt', 'text/plain');
    console.log('✅ Upload successful:', objectPath);
    console.log();

    // Test metadata retrieval
    console.log('📋 Testing metadata retrieval...');
    const fileInfo = await r2.getObjectEntityFile(objectPath);
    console.log('✅ Metadata retrieved:');
    console.log('   - Key:', fileInfo.key);
    console.log('   - Content Type:', fileInfo.contentType);
    console.log('   - Original Name:', fileInfo.metadata?.originalName);
    console.log();

    // Test presigned URL generation
    console.log('🔗 Testing presigned URL generation...');
    const downloadUrl = await r2.getPresignedDownloadUrl(objectPath, 300);
    console.log('✅ Presigned URL generated (valid for 5 minutes)');
    console.log('   URL:', downloadUrl.substring(0, 100) + '...');
    console.log();

    // Test deletion
    console.log('🗑️  Testing file deletion...');
    const deleted = await r2.deleteObject(objectPath);
    if (deleted) {
      console.log('✅ File deleted successfully\n');
    } else {
      console.log('⚠️  File deletion returned false (might not exist)\n');
    }

    // Final summary
    console.log('═══════════════════════════════════════════');
    console.log('🎉 All R2 tests passed!');
    console.log('═══════════════════════════════════════════');
    console.log('Your Cloudflare R2 configuration is working correctly.');
    console.log('Bucket:', process.env.R2_BUCKET_NAME);
    console.log('Account ID:', process.env.R2_ACCOUNT_ID);
    console.log('\nYou can now use R2 storage in your application.\n');

  } catch (error: any) {
    console.error('\n❌ R2 Test Failed!\n');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Invalid R2 credentials (check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY)');
    console.error('2. Incorrect bucket name (check R2_BUCKET_NAME)');
    console.error('3. Insufficient permissions on R2 API token');
    console.error('4. Account ID mismatch (check R2_ACCOUNT_ID)');
    console.error('\nFull error details:');
    console.error(error);
    console.error();
    process.exit(1);
  }
}

// Run the test
testR2Connection().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
