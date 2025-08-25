import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import B2BOrder from '@/models/B2BOrder';

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    await connectToDb();
    const order = await B2BOrder.findById(id).lean();
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
