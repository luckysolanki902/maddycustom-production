import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';

export async function GET() {
  await connectToDatabase();

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const baseUrl = 'https://maddycustom.com';

  const products = await Product.find({}, { pageSlug: 1, images: 1, title: 1, description: 1 }).lean().exec();

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      ${products
        .map((product) => {
          // Check and modify title if it ends with 's'
          const formattedTitle = product.title.endsWith('s')
            ? product.title.slice(0, -1)  // Remove trailing 's'
            : product.title;

          return `
            <url>
              <loc>${baseUrl}/shop${product.pageSlug}</loc>
              ${product.images.slice(0, 1).map((image) => `
                <image:image>
                  <image:loc>${baseImageUrl}${image}</image:loc>
                  <image:title><![CDATA[${formattedTitle} - Buy Now | Maddy Custom]]></image:title>
                  <image:caption><![CDATA[${product.description}]]></image:caption>
                  <image:alt><![CDATA[${formattedTitle} - Custom Wraps and Graphics]]></image:alt>
                </image:image>`).join('')}
            </url>`;
        }).join('')}
    </urlset>`;

  return new NextResponse(xmlContent, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
