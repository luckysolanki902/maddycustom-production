// /app/api/modeOfPayment/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import ModeOfPayment from '@/models/ModeOfPayment';

/**
 * POST /api/modeOfPayment
 * Creates predefined payment modes: 'online' and 'fifty'.
 */
export async function GET(request) {
  try {
    // Connect to the database
    await connectToDatabase();

    // Predefined payment modes
    const paymentModes = [
      {
        name: 'online',
        caption: '',
        description: 'Cards, UPI, Wallets',
        extraCharge: 0,
        configuration: {
          onlinePercentage: 100,
          codPercentage: 0,
        },
      },
      {
        name: 'fifty',
        caption: '50% online 50% COD',
        description: 'Cards, UPI, Wallets in parts',
        extraCharge: 100,
        configuration: {
          onlinePercentage: 50,
          codPercentage: 50,
        },
      },
    ];

    // Create or update payment modes
    const results = await Promise.all(paymentModes.map(async (mode) => {
      return await ModeOfPayment.findOneAndUpdate(
        { name: mode.name },
        { $set: mode },
        { upsert: true, new: true, runValidators: true }
      );
    }));

    return NextResponse.json({
      message: 'Payment modes created/updated successfully.',
      data: results,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating payment modes:', error);
    return NextResponse.json(
      { error: 'Failed to create payment modes.' },
      { status: 500 }
    );
  }
}
