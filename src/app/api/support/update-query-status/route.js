// /app/api/support/update-query-status/route.js
import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import SupportRequest from '@/models/SupportRequest';

export async function POST(req) {
  try {
    await connectToDb();
    const { requestId, resolved } = await req.json();
    // Set status and who resolved the query based on user feedback
    const status = resolved ? 'resolved' : 'unresolved';
    const resolvedBy = resolved ? 'ai' : 'support team';

    const updated = await SupportRequest.findByIdAndUpdate(
      requestId,
      { status, resolvedBy },
      { new: true }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Status updated successfully', updated });
  } catch (error) {
    console.error('Error updating query status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
