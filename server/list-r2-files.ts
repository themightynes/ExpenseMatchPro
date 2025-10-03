/**
 * List files in R2 bucket
 */

import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

async function listR2Files() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });

  console.log('\n📦 Listing files in R2 bucket...\n');

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    MaxKeys: 20,
  });

  const response = await s3Client.send(command);

  console.log(`Found ${response.Contents?.length || 0} files (showing first 20):\n`);

  response.Contents?.forEach((obj, i) => {
    console.log(`${i + 1}. ${obj.Key}`);
    console.log(`   Size: ${obj.Size} bytes`);
    console.log(`   Last Modified: ${obj.LastModified}`);
    console.log();
  });

  console.log(`Total objects in bucket: ${response.KeyCount}`);
}

listR2Files().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
