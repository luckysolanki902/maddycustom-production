// /pages/api/test/make-tags-to-lower-case/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';

export async function GET(req) {
  try {
    await connectToDatabase();

    // Fetch all products that have mainTags
    const products = await Product.find({
      mainTags: { $exists: true, $not: { $size: 0 } },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { message: 'No products found with mainTags to update.' },
        { status: 200 }
      );
    }

    // Prepare bulk operations to convert mainTags to lowercase
    const bulkOps = products.map((product) => {
      const lowerCaseTags = product.mainTags.map((tag) => tag.toLowerCase());
      return {
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { mainTags: lowerCaseTags } },
        },
      };
    });

    // Execute bulk write operations
    await Product.bulkWrite(bulkOps);
    console.log('mainTags have been converted to lowercase.');

    return NextResponse.json(
      { message: 'mainTags conversion to lowercase completed successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error converting mainTags to lowercase:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
