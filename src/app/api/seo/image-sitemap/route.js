// app/api/seo/image-sitemap/route.js
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const baseUrl = 'https://www.maddycustom.com';

    const products = await Product.find({}, { pageSlug: 1, images: 1, title: 1, description: 1 }).lean();

    const sitemapData = products.map((product) => ({
      url: `${baseUrl}/shop${product.pageSlug}`,
      images: product.images.map((image) => ({
        loc: `${baseImageUrl}${image}`,
        title: `${product.title} - Buy Now | Maddy Custom`,
        caption: product.description || product.title,
        alt: `${product.title} - Custom Wraps and Graphics`,
      })),
    }));

    return NextResponse.json({ sitemapData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
