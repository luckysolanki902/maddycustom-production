// app/api/showcase/happy-customers/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import HappyCustomer from '@/models/HappyCustomer';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const parentSpecificCategoryId = searchParams.get('parentSpecificCategoryId');
  const homepage = searchParams.get('homepage');

  try {
    console.info('Attempting to connect to the database...');
    await connectToDatabase();
    let filter = { isActive: true }; // Base filter for active happy customers

    if (homepage === 'true') {
      filter = { ...filter, showOnHomepage: true };
    } else if (parentSpecificCategoryId) {
      filter = {
        ...filter,
        $or: [
          { isGlobal: true },
          { 'placements.refId': parentSpecificCategoryId },
        ],
      };
    } else {
      console.warn('Invalid request parameters provided.');
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const happyCustomers = await HappyCustomer.find(filter)
      .sort({ isGlobal: -1, globalDisplayOrder: 1, 'placements.displayOrder': 1 }) // Global and homepage customers first
      .select('name photo');

    return NextResponse.json({ happyCustomers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching happy customers:', error.message);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
