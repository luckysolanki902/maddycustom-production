import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';

// Cache this route response for 1 hour (adjust to 86400 for 24h if needed)
export const revalidate = 3600;

export async function GET() {
  try {
    await connectToDb();
    const cats = await SpecificCategory.find({ available: true })
      .select('_id name title description category subCategory classificationTags available')
      .sort({ title: 1 })
      .lean();

    const categories = cats.map(c => ({
      id: c._id.toString(),
      name: c.name,
      title: c.title || c.name,
      description: c.description || '',
      category: c.category || null,
      subCategory: c.subCategory || null,
      classificationTags: Array.isArray(c.classificationTags) ? c.classificationTags : [],
    }));

    return NextResponse.json({
      categories,
      count: categories.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to load categories-info', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
