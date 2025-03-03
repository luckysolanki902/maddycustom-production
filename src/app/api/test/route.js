// app/api/test-sms/route.js
import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/utils/twilioSender';

export async function GET() {
  const testNumber = '+18777804236';
  const testMessage = 'This is a test SMS from Twilio.hellow hello';
  const result = await sendSMS({ to: testNumber, body: testMessage });
  return NextResponse.json(result);
}
