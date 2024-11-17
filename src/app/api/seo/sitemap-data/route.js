import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();

    // Fetch all products
    const products = await Product.find({}, { pageSlug: 1 }).lean().exec();

    // Fetch all variants
    const variants = await SpecificCategoryVariant.find({}, { pageSlug: 1 }).lean().exec();

    return NextResponse.json({
      products: products.map(({ pageSlug }) => ({
        pageSlug,
      })),
      variants: variants.map(({ pageSlug }) => ({
        pageSlug,
      })),
    });
  } catch (error) {
    console.error('Error fetching sitemap data:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
