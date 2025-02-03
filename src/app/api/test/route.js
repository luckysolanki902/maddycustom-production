// pages/api/test/route.js

import { NextResponse } from 'next/server';

export async function GET(req) {
    return NextResponse.json({ message: 'success' }, { status: 200 });
}
