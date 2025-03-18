// app/api/showcase/featured-products/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('categoryCode');
  // Read the "number" parameter (default to 4 if not provided)
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

    // For each variant, fetch one random product using aggregation
    const initialProducts = await Promise.all(
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

    // Filter out any variants that didn't return a product
    let filteredProducts = initialProducts.filter(product => product !== null);

    // If we have fewer products than requested, do a round-robin fetch for extra products.
    if (filteredProducts.length < sampleSize) {
      // Maintain a map to track which product IDs have already been fetched for each variant
      const fetchedProductsMap = {};
      filteredProducts.forEach(product => {
        const vid = product.variantId.toString();
        if (!fetchedProductsMap[vid]) {
          fetchedProductsMap[vid] = [product._id];
        } else {
          fetchedProductsMap[vid].push(product._id);
        }
      });

      // Continue fetching additional products in a round-robin fashion until we reach sampleSize or no new products are available
      let additionalFetched = true;
      while (filteredProducts.length < sampleSize && additionalFetched) {
        additionalFetched = false;
        for (const variant of variants) {
          if (filteredProducts.length >= sampleSize) break;
          const vid = variant._id;
          const alreadyFetched = fetchedProductsMap[vid.toString()] || [];
          // Fetch one extra product for the variant, excluding those already fetched
          const newProductResult = await Product.aggregate([
            { 
              $match: { 
                specificCategoryVariant: vid, 
                _id: { $nin: alreadyFetched }
              }
            },
            { $sample: { size: 1 } }
          ]);
          if (newProductResult && newProductResult.length > 0) {
            const newProduct = { ...newProductResult[0], variantId: vid };
            filteredProducts.push(newProduct);
            if (!fetchedProductsMap[vid.toString()]) {
              fetchedProductsMap[vid.toString()] = [];
            }
            fetchedProductsMap[vid.toString()].push(newProduct._id);
            additionalFetched = true;
          }
        }
      }
    }

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
