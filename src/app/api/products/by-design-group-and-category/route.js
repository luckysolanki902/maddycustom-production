import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const designGroupId = searchParams.get('designGroupId');
    const categoryId = searchParams.get('categoryId');
    const includeInventory = searchParams.get('includeInventory') === 'true';

    if (!designGroupId || !categoryId) {
      return NextResponse.json(
        { message: 'Design Group ID and Category ID are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Build query to find products by design group and category
    let query = Product.find({
      designGroupId: designGroupId,
      $or: [
        { specificCategory: categoryId },
        { category: categoryId }
      ],
      available: true
    }).populate("specificCategory specificCategoryVariant");

    // Include inventory data if requested
    if (includeInventory) {
      query = query.populate('inventoryData');
    }

    const products = await query.lean().exec();

    const enhancedProducts = products.map(product => {
      const newProduct = {
        ...product,
        variant: product.specificCategoryVariant,
        category: product.specificCategory,
      };

      delete newProduct.specificCategory;
      delete newProduct.specificCategoryVariant;
      
      return newProduct;
    });

    return NextResponse.json({ products: enhancedProducts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching products by design group and category:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}