// Updated GET Method in /api/shop/happycustomers
import connectToDatabase from '@/lib/middleware/connectToDb';
import HappyCustomer from '@/models/HappyCustomer';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.info("Received request to /api/shop/happycustomers with GET method");

    const url = new URL(request.url);
    const parentSpecificCategory = url.searchParams.get('parentSpecificCategory');

    if (!parentSpecificCategory) {
      console.error("Request missing 'parentSpecificCategory' parameter");
      return NextResponse.json({ message: 'Parent specific category ID is required.' }, { status: 400 });
    }

    await connectToDatabase();
    console.info("Connected to the database successfully");

    const specificCategory = await SpecificCategory.findById(parentSpecificCategory).lean().exec();

    if (!specificCategory) {
      console.warn(`No SpecificCategory found for ID: ${parentSpecificCategory}`);
      return NextResponse.json({ message: 'Specific category not found' }, { status: 404 });
    }

    const { specificCategoryCode } = specificCategory;
    console.info(`Found SpecificCategory with code: ${specificCategoryCode}`);

    const happyCustomers = await HappyCustomer.find({
      isActive: true,
      "pagesToAppearOn.specificCategoryCode": specificCategoryCode
    })
      .sort({ "pagesToAppearOn.displayOrder": 1 })
      .lean()
      .exec();

    if (happyCustomers.length > 0) {
      console.info(`Found ${happyCustomers.length} happy customers for specificCategoryCode: ${specificCategoryCode}`);
      return NextResponse.json({ happyCustomers }, { status: 200 });
    }

    console.warn(`No happy customers found for specificCategoryCode: ${specificCategoryCode}`);
    return NextResponse.json({ message: 'No happy customers found' }, { status: 404 });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// Updated POST Method in /api/shop/happycustomers
export async function POST(request) {
  try {
    console.info("Received request to /api/shop/happycustomers with POST method");

    const { parentSpecificCategory } = await request.json();

    if (!parentSpecificCategory) {
      console.error("Request missing 'parentSpecificCategory' parameter");
      return NextResponse.json({ message: 'Parent specific category ID is required.' }, { status: 400 });
    }

    await connectToDatabase();
    console.info("Connected to the database successfully");

    const specificCategory = await SpecificCategory.findById(parentSpecificCategory).lean().exec();

    if (!specificCategory) {
      console.warn(`No SpecificCategory found for ID: ${parentSpecificCategory}`);
      return NextResponse.json({ message: 'Specific category not found' }, { status: 404 });
    }

    const { specificCategoryCode } = specificCategory;
    console.info(`Found SpecificCategory with code: ${specificCategoryCode}`);

    const happyCustomers = await HappyCustomer.find({
      isActive: true,
      "pagesToAppearOn.specificCategoryCode": specificCategoryCode
    })
      .sort({ "pagesToAppearOn.displayOrder": 1 })
      .lean()
      .exec();

    if (happyCustomers.length > 0) {
      console.info(`Found ${happyCustomers.length} happy customers for specificCategoryCode: ${specificCategoryCode}`);
      return NextResponse.json({ happyCustomers }, { status: 200 });
    }

    console.warn(`No happy customers found for specificCategoryCode: ${specificCategoryCode}`);
    return NextResponse.json({ message: 'No happy customers found' }, { status: 404 });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
