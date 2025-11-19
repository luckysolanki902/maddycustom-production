import { NextResponse } from 'next/server';
import { verifyPayuPayments } from '@/lib/payments/payu/api';

export async function POST(request) {
  try {
    const { txnIds } = await request.json();

    if (!txnIds || !Array.isArray(txnIds) || txnIds.length === 0) {
      return NextResponse.json({ error: 'txnIds array is required.' }, { status: 400 });
    }

    const response = await verifyPayuPayments(txnIds);
    
    let responseData;
    try {
      responseData = JSON.parse(response.body);
    } catch {
      return NextResponse.json({ error: 'Invalid response from payment gateway.' }, { status: 500 });
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Payment verification failed', error);
    return NextResponse.json({ error: 'Failed to verify payment status.' }, { status: 500 });
  }
}
