import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();

    // Fetch all available products first
    const products = await Product.find(
      { available: true }, 
      { pageSlug: 1, specificCategory: 1, specificCategoryVariant: 1, updatedAt: 1 }
    )
      .populate('specificCategory', 'available')
      .populate('specificCategoryVariant', 'available')
      .lean()
      .exec();

    // Filter products where all related entities are available
    const filteredProducts = products.filter(product => {
      // Product must be available (already filtered in query)
      // SpecificCategory must exist and be available
      if (!product.specificCategory || product.specificCategory.available !== true) {
        return false;
      }
      // If product has a specificCategoryVariant, it must be available
      if (product.specificCategoryVariant && product.specificCategoryVariant.available !== true) {
        return false;
      }
      return true;
    });

    // Fetch all available variants first
    const variants = await SpecificCategoryVariant.find(
      { available: true }, 
      { pageSlug: 1, specificCategory: 1, updatedAt: 1, available: 1 }
    )
      .populate('specificCategory', 'available')
      .lean()
      .exec();

    // Filter variants where specificCategory is available
    const filteredVariants = variants.filter(variant => 
      variant.specificCategory && variant.specificCategory.available === true
    );

    console.log(`Found ${filteredProducts.length} available products and ${filteredVariants.length} available variants`);

    return NextResponse.json({
      products: filteredProducts.map(({ pageSlug, updatedAt }) => ({
        pageSlug,
        lastModified: updatedAt || new Date(),
      })),
      variants: filteredVariants.map(({ pageSlug, updatedAt }) => ({
        pageSlug,
        lastModified: updatedAt || new Date(),
      })),
    });
  } catch (error) {
    console.error('Error fetching sitemap data:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
