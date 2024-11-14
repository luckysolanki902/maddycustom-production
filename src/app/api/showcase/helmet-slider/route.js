// @/app/api/showcase/helmet-slider/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  try {
    // Find SpecificCategoryVariants with variantCode 'hel'
    const helmetVariants = await SpecificCategoryVariant.find({ variantCode: 'hel' });

    // Get the IDs of these variants
    const helmetVariantIds = helmetVariants.map(variant => variant._id);

    // Get 10 random products that reference these helmet variants
    const helmetProducts = await Product.aggregate([
      { $match: { specificCategoryVariant: { $in: helmetVariantIds } } },
      { $sample: { size: 10 } }  // Randomly select 10 products
    ]);

    return NextResponse.json(helmetProducts);
  } catch (error) {
    console.error("Error fetching helmet products:", error);
    return NextResponse.json({ message: "Error fetching helmet products" }, { status: 500 });
  }
}
