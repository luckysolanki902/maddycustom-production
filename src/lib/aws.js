// @/lib/aws.js

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generates a presigned URL for uploading or downloading a file to/from S3.
 *
 * @param {string} fullPath - The desired S3 object key (path).
 * @param {string} fileType - The MIME type of the file (used for uploading).
 * @param {string} operation - 'putObject' for uploading, 'getObject' for downloading.
 * @returns {Promise<{ presignedUrl: string, url: string }>} - The presigned URL and the final file URL.
 */
export const getPresignedUrl = async (
  fullPath,
  fileType = 'application/octet-stream',
  operation = 'putObject'
) => {
  try {
    let command;

    if (operation === 'putObject') {
      command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: fullPath.startsWith('/') ? fullPath.slice(1) : fullPath,
        ContentType: fileType,
      });
    } else if (operation === 'getObject') {
      command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: fullPath.startsWith('/') ? fullPath.slice(1) : fullPath,
      });
    } else {
      throw new Error('Invalid operation for presigned URL.');
    }

    // Generate a presigned URL valid for 15 minutes (900 seconds)
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Construct the final URL where the file will be accessible
    const url = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fullPath.startsWith('/') ? fullPath.slice(1) : fullPath}`;

    return { presignedUrl, url };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};
