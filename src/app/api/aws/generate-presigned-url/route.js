// app/api/aws/generate-presigned-url/route.js

import { NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/aws';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // You can keep this for any additional data
    },
  },
};

export async function POST(request) {
  try {
    const { fullPath, fileType } = await request.json();
    if (!fullPath || !fileType) {
      return NextResponse.json(
        { message: 'Missing required parameters: fullPath and fileType' },
        { status: 400 }
      );
    }
    const { presignedUrl, url } = await getPresignedUrl(fullPath, fileType);
    return NextResponse.json({ presignedUrl, url }, { status: 200 });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { message: 'Failed to generate presigned URL', error: error.message },
      { status: 500 }
    );
  }
}
