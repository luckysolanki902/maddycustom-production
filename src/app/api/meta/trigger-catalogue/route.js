// app/api/meta/trigger-catalogue/route.js

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Trigger the catalogue generation by calling the cron endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/cron/meta/generate-catalogue`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to trigger catalogue generation');
    }

    return NextResponse.json({
      success: true,
      message: 'Catalogue generation triggered successfully',
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error triggering catalogue generation:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger catalogue generation',
        message: error.message,
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to trigger catalogue generation',
    endpoints: {
      trigger: 'POST /api/meta/trigger-catalogue',
      status: 'GET /api/meta/catalogue-status',
      cron: 'GET /api/cron/meta/generate-catalogue',
    },
  });
}
