import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

// Cache product lookups for 10 minutes
export const revalidate = 600;

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const productName = searchParams.get('productName');
    const variantCode = searchParams.get('variantCode'); // Optional filter by variant code

    if (!categoryId || !productName) {
      return NextResponse.json(
        { message: 'Category ID and Product Name are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Build query
    const query = {
      specificCategory: categoryId,
      name: productName,
      available: true
    };

    // Find products by category and name (case-insensitive)
    let products = await Product.find(query)
    .populate('specificCategory specificCategoryVariant inventoryData')
    .lean()
    .exec();

    // Filter by variantCode if provided (after population)
    if (variantCode) {
      products = products.filter(product => {
        const productVariantCode = product.specificCategoryVariant?.variantCode;
        return productVariantCode && productVariantCode.toLowerCase() === variantCode.toLowerCase();
      });
    }

    const enhancedProducts = products.map(product => {
      const newProduct = {
        ...product,
        variantDetails: product.specificCategoryVariant,
        category: product.specificCategory,
      };

      delete newProduct.specificCategory;
      delete newProduct.specificCategoryVariant;
      
      return newProduct;
    });

    return NextResponse.json({ products: enhancedProducts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching products by category and name:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}