import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const baseUrl = 'https://www.maddycustom.com';

    // Fetch products with related variants
    const products = await Product.find({})
      .populate('specificCategoryVariant') // Populate the variant data
      .lean();

    const sitemapData = products.map((product) => {
      const variant = product.specificCategoryVariant;

      // Ensure a variant exists for the product
      if (!variant) return null;

      const description = variant.productDescription
        ?.replace(/{uniqueName}/g, product.name)
        ?.replace(/{fullBikename}/g, variant.name);

      return {
        url: `${baseUrl}/shop${product.pageSlug}`,
        images: product.images.map((image) => ({
          loc: `${baseImageUrl}${image}`,
          title: `${product.title} - Buy Now | Maddy Custom`,
          caption: description || '',
          alt: `${product.title} - Custom Wraps and Graphics`,
        })),
      };
    }).filter(Boolean); // Filter out null entries where no variant exists

    return NextResponse.json({ sitemapData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
