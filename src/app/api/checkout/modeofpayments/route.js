// app/api/checkout/modeofpayments/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import ModeOfPayment from '@/models/ModeOfPayment';

// export const revalidate = 3600; // seconds
export async function GET() {
  try {
    // Connect to the database
    await connectToDatabase();

    // Fetch active modes of payment, sorted by name or any preferred order
    const paymentModes = await ModeOfPayment.find({ isActive: true }).sort({ name: 1 });

    return NextResponse.json(
      { data: paymentModes },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching modes of payment:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch modes of payment.' },
      { status: 500 }
    );
  }
}
