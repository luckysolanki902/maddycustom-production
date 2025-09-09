import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';

export async function GET(req, { params }) {
  try {
    await connectToDb();
    
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const category = await SpecificCategory.findById(id)
      .select('_id name specificCategoryCode description pageSlug useLetterMapping letterMappingGroups')
      .lean();

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching specific category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
