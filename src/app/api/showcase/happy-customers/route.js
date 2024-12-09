// app/api/showcase/happy-customers/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import HappyCustomer from '@/models/HappyCustomer';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const parentSpecificCategoryId = searchParams.get('parentSpecificCategoryId');
  const homepage = searchParams.get('homepage');

  try {
    await connectToDatabase();

    let filter = { isActive: true }; // Base filter for active happy customers

    if (homepage === 'true') {
      // Fetch customers flagged for the homepage
      filter = { ...filter, showOnHomepage: true };
    } else if (parentSpecificCategoryId) {
      // Fetch customers for a specific variant or global ones
      filter = {
        ...filter,
        $or: [
          { isGlobal: true },
          { 'placements.refId': parentSpecificCategoryId },
        ],
      };
    } else {
      // Invalid request if no valid condition is met
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    // Fetch and sort happy customers
    const happyCustomers = await HappyCustomer.find(filter)
      .sort({ isGlobal: -1, globalDisplayOrder: 1, 'placements.displayOrder': 1 }) // Global and homepage customers first
      .select('name photo');

    return NextResponse.json({ happyCustomers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching happy customers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
