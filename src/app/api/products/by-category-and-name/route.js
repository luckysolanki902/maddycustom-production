import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const productName = searchParams.get('productName');

    if (!categoryId || !productName) {
      return NextResponse.json(
        { message: 'Category ID and Product Name are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find products by category and name (case-insensitive)
    const products = await Product.find({
      specificCategory: categoryId,
      name: productName,
      available: true
    })
    .populate('specificCategory specificCategoryVariant inventoryData')
    .lean()
    .exec();

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