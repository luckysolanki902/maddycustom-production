import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

export async function GET() {
  await connectToDatabase();

  const baseVideoUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const baseUrl = 'https://maddycustom.com';

  const variants = await SpecificCategoryVariant.find(
    { 'showCase.available': true }, // Filter only available showcases
    { pageSlug: 1, showCase: 1, name: 1, description: 1, keywords: 1, features: 1 }
  ).lean().exec();

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
      ${variants
        .map((variant) => {
          // SEO-optimized title and description
          const seoTitle = variant.name ? `${variant.name} - Maddy Custom` : 'Maddy Custom';
          const seoDescription = variant.description || 'Explore our top-notch custom graphic videos.';
          const seoKeywords = variant.keywords?.join(', ') || 'custom graphics, video showcase';

          return `
          <url>
            <loc>${baseUrl}/shop${variant.pageSlug}</loc>
            ${variant.showCase
              .filter((showcase) => showcase.available)
              .map((showcase) => `
              <video:video>
                <video:title><![CDATA[${seoTitle}]]></video:title>
                <video:description><![CDATA[${seoDescription}]]></video:description>
                <video:content_loc>${baseVideoUrl}${showcase.url}</video:content_loc>
                <video:player_loc>${baseUrl}/videoplayer?video=${showcase.videoId}</video:player_loc>
                <video:duration>${showcase.duration || 600}</video:duration>
                <video:tag><![CDATA[${seoKeywords}]]></video:tag>
              </video:video>`).join('')}
          </url>`;
        }).join('')}
    </urlset>`;

  return new NextResponse(xmlContent, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
