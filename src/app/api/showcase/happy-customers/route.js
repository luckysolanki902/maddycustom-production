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
    console.info('Database connection established successfully.');

    let filter = { isActive: true }; // Base filter for active happy customers

    if (homepage === 'true') {
      console.info('Fetching happy customers flagged for the homepage.');
      filter = { ...filter, showOnHomepage: true };
    } else if (parentSpecificCategoryId) {
      console.info(
        `Fetching happy customers for category ID: ${parentSpecificCategoryId}, including global ones.`
      );
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

    console.info('Executing query to fetch happy customers with filter:', filter);
    const happyCustomers = await HappyCustomer.find(filter)
      .sort({ isGlobal: -1, globalDisplayOrder: 1, 'placements.displayOrder': 1 }) // Global and homepage customers first
      .select('name photo');

    console.info(`Successfully fetched ${happyCustomers.length} happy customers.`);
    return NextResponse.json({ happyCustomers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching happy customers:', error.message);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
