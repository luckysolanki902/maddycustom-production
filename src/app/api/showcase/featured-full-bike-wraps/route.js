// @/app/api/showcase/featured-full-bike-wraps/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  try {
    // Find the SpecificCategory with specificCategoryCode 'flw'
    const category = await SpecificCategory.findOne({ specificCategoryCode: 'fbw' });

    if (!category) {
      return NextResponse.json({ message: "No category found with code 'flw'" }, { status: 404 });
    }

    // Find 4 random SpecificCategoryVariants associated with this category
    const variants = await SpecificCategoryVariant.aggregate([
      { $match: { specificCategory: category._id } },
      { $sample: { size: 4 } },
    ]);

    // Fetch products and only pass the variant ID in each product
    const products = await Promise.all(
      variants.map(async (variant) => {
        const product = await Product.findOne({ specificCategoryVariant: variant._id }).limit(1);
        return product ? { ...product.toObject(), variantId: variant._id } : null;
      })
    );

    // Filter out any null results in case a variant has no associated products
    const filteredProducts = products.filter(product => product !== null);

    return NextResponse.json({
      category,
      variants,
      products: filteredProducts
    });
  } catch (error) {
    console.error("Error fetching featured bike wraps:", error);
    return NextResponse.json({ message: "Error fetching featured bike wraps" }, { status: 500 });
  }
}
