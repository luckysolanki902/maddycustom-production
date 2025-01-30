// pages/api/test/route.js

import { NextResponse } from 'next/server';

export async function GET(req) {
    console.log('hey api was hit using cron job');
    return NextResponse.json({ message: 'success' }, { status: 200 });
}
