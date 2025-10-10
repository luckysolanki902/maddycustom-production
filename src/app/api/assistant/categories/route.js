import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';

export async function GET() {
  try {
    await connectToDb();
    const cats = await SpecificCategory.find({ available: { $ne: false } })
      .select('_id name title pageSlug classificationTags available')
      .lean();
    const mapped = cats.map(c => ({
      id: c._id.toString(),
      name: c.name,
      title: c.title || c.name,
      pageSlug: c.pageSlug,
      classificationTags: c.classificationTags || []
    }));
    return NextResponse.json({ categories: mapped });
  } catch (e) {
    console.error('Failed to load categories', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}