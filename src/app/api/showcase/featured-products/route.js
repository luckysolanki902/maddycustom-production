// app/api/showcase/featured-products/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('categoryCode');
  // Read the new "number" parameter (default to 4 if not provided)
  const numberParam = searchParams.get('number');
  const sampleSize = numberParam ? parseInt(numberParam, 10) : 4;

  await connectToDatabase();

  try {
    // Find the category by its code
    const category = await SpecificCategory.findOne({ specificCategoryCode: categoryCode });
    if (!category) {
      return NextResponse.json(
        { message: `No category found with code '${categoryCode}'` },
        { status: 404 }
      );
    }

    // Get random variants (using the sampleSize from the query)
    const variants = await SpecificCategoryVariant.aggregate([
      { $match: { specificCategory: category._id } },
      { $sample: { size: sampleSize } },
    ]);

    // For each variant, fetch a random product design using aggregation
    const products = await Promise.all(
      variants.map(async (variant) => {
        const randomProduct = await Product.aggregate([
          { $match: { specificCategoryVariant: variant._id } },
          { $sample: { size: 1 } },
        ]);

        if (!randomProduct || randomProduct.length === 0) {
          return null;
        }
        // Append the variantId for reference in the client
        return { ...randomProduct[0], variantId: variant._id };
      })
    );

    // Remove any null results (in case a variant has no product)
    const filteredProducts = products.filter(product => product !== null);

    return NextResponse.json({
      category,
      variants,
      products: filteredProducts,
    });
  } catch (error) {
    console.error("Error fetching featured bike wraps:", error.message);
    return NextResponse.json(
      { message: "Error fetching featured bike wraps" },
      { status: 500 }
    );
  }
}
