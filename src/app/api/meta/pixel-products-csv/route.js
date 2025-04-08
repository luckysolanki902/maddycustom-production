// app/api/meta/pixel-products-csv/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import { NextResponse } from 'next/server';
import { Parser } from 'json2csv';

export const revalidate = 3600; // seconds
export async function GET() {
  try {
    // 1) Connect to DB
    await connectToDatabase();

    // 2) Fetch all catalogue entries.
    const catalogueEntries = await Catalogue.find().lean();

    // 3) Build CSV data from the feedData field.
    const csvData = catalogueEntries.map((entry) => entry.feedData);

    // 4) Define CSV fields.
    const fields = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'link',
      'image_link',
      'brand',
    ];

    // 5) Convert to CSV.
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    // 6) Return CSV response.
    // return new NextResponse(csv, {
    //   status: 200,
    //   headers: {
    //     'Content-Type': 'text/csv',
    //   },
    // });
    return NextResponse.json(csvData, { status: 200 });
  } catch (error) {
    console.error('Error generating CSV:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
