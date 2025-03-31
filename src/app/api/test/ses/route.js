// app/api/send-test-email/route.js
import { NextResponse } from 'next/server';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'ap-south-1' });

export async function GET() {
  try {
    const params = {
      Source: 'contact@maddycustom.com', // Replace with your verified SES email
      Destination: {
        ToAddresses: ['luckysolanki902@gmail.com'],
      },
      Message: {
        Subject: { Data: 'Test Email from SES & Next.js' },
        Body: {
          Text: { Data: 'Hello Lucky, this is a test email sent via AWS SES using Next.js 15 App Router.' },
        },
      },
    };

    const command = new SendEmailCommand(params);
    await sesClient.send(command);

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
