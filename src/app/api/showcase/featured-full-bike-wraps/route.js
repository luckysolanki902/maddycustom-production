// app/api/showcase/featured-full-bike-wraps/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET() {
  await connectToDatabase();

  try {
    // Find the SpecificCategory with specificCategoryCode 'fbw'
    const category = await SpecificCategory.findOne({ specificCategoryCode: 'fbw' });

    if (!category) {
      // console.warn("Featured Full Bike Wraps: No category found with specificCategoryCode 'fbw'.");
      return NextResponse.json({ message: "No category found with code 'fbw'" }, { status: 404 });
    }

    // Find 4 random SpecificCategoryVariants associated with this category
    const variants = await SpecificCategoryVariant.aggregate([
      { $match: { specificCategory: category._id } },
      { $sample: { size: 4 } },
    ]);

    if (!variants || variants.length === 0) {
      // console.warn(`Featured Full Bike Wraps: No variants found for categoryId=${category._id}.`);
    }

    // Fetch products and only pass the variant ID in each product
    const products = await Promise.all(
      variants.map(async (variant) => {
        const product = await Product.findOne({ specificCategoryVariant: variant._id }).limit(1);
        if (!product) {
          // console.warn(`Featured Full Bike Wraps: No product found for variantId=${variant._id}.`);
          return null;
        }
        return { ...product.toObject(), variantId: variant._id };
      })
    );

    // Filter out any null results in case a variant has no associated products
    const filteredProducts = products.filter(product => product !== null);

    if (filteredProducts.length === 0) {
      // console.warn('Featured Full Bike Wraps: No products found for the selected variants.');
    }

    return NextResponse.json({
      category,
      variants,
      products: filteredProducts
    });
  } catch (error) {
    console.error("Error fetching featured bike wraps:", error.message);
    return NextResponse.json({ message: "Error fetching featured bike wraps" }, { status: 500 });
  }
}
