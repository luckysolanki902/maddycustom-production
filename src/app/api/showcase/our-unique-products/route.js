// app/api/showcase/our-unique-products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  try {
    // Fetch the first four variants with variantCode 'win' and 'tw-s'
    const winVariants = await SpecificCategoryVariant.find({ variantCode: 'win' }).limit(4);
    const twsVariants = await SpecificCategoryVariant.find({ variantCode: 'tw-s' }).limit(4);

    if (!winVariants || winVariants.length === 0) {
      // console.warn("Our Unique Products: No variants found with variantCode 'win'.");
    }
    if (!twsVariants || twsVariants.length === 0) {
      // console.warn("Our Unique Products: No variants found with variantCode 'tw-s'.");
    }

    // Extract the variant IDs
    const winVariantIds = winVariants.map(variant => variant._id);
    const twsVariantIds = twsVariants.map(variant => variant._id);

    // Fetch 4 random products for each variant group
    const winProducts = await Product.aggregate([
      { $match: { specificCategoryVariant: { $in: winVariantIds } } },
      { $sample: { size: 4 } }
    ]);

    const twsProducts = await Product.aggregate([
      { $match: { specificCategoryVariant: { $in: twsVariantIds } } },
      { $sample: { size: 4 } }
    ]);

    if ((!winProducts || winProducts.length === 0) && (!twsProducts || twsProducts.length === 0)) {
      // console.warn('Our Unique Products: No products found for the selected variants.');
    }

    // Combine in alternating order
    const combinedProducts = [];
    for (let i = 0; i < 4; i++) {
      if (winProducts[i]) combinedProducts.push(winProducts[i]);
      if (twsProducts[i]) combinedProducts.push(twsProducts[i]);
    }

    return NextResponse.json(combinedProducts, { status: 200 });
  } catch (error) {
    console.error("Error fetching showcase products:", error.message);
    return NextResponse.json({ message: "Error fetching showcase products" }, { status: 500 });
  }
}
