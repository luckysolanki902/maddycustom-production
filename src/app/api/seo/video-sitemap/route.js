import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const baseUrl = 'https://www.maddycustom.com';

    const variants = await SpecificCategoryVariant.find(
      { 'showCase.available': true },
      { pageSlug: 1, showCase: 1, name: 1, description: 1, keywords: 1 }
    ).lean();

    const sitemapData = variants.map((variant) => ({
      url: `${baseUrl}/shop${variant.pageSlug}`,
      videos: variant.showCase.map((showcase) => ({
        thumbnailLoc: `${baseImageUrl}${showcase.thumbnail}`,
        title: `${variant.name || 'Maddy Custom'} - Video Showcase`,
        description: variant.description || 'Explore our custom graphics videos.',
        contentLoc: `${baseImageUrl}${showcase.url}`,
        playerLoc: `${baseUrl}/videoplayer?video=${showcase.videoId}`,
        duration: showcase.duration || 600,
        tags: variant.keywords?.join(', ') || 'custom graphics, video showcase',
      })),
    }));

    return NextResponse.json({ sitemapData });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
