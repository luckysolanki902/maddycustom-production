// app/api/features/get-variants/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(req) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId');

  if (!categoryId) {
    return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
  }

  // Find all variants for the specific category
  const variants = await SpecificCategoryVariant.find({ specificCategory: categoryId });
  // If there is only one variant, no need to show "Change Variant" button
  if (variants.length < 2) {
    return NextResponse.json({ variants: [], hasMultiple: false });
  }

  // Fetch the first product and its first image for each variant
  const variantData = await Promise.all(
    variants.map(async (variant) => {
      const firstProduct = await Product.findOne({ specificCategoryVariant: variant._id });
      const firstImage = firstProduct?.images?.[0] || null;
      return {
        id: variant._id,
        name: variant.name,
        image: firstImage,
        pageSlug: variant.pageSlug,
        variantInfo: variant.variantInfo,
      };
    })
  );

  return NextResponse.json({
    variants: variantData,
    hasMultiple: true,
  });
}
