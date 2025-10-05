// /api/variants/by-specific-category?id=<specificCategoryId>
// Returns variants and (if enabled) letter mapping groups for a SpecificCategory.
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  try {
    await connectToDatabase();
    const [specCat, variants] = await Promise.all([
      SpecificCategory.findById(id).lean(),
      SpecificCategoryVariant.find({ specificCategory: id, available: true })
        .select('_id variantCode name title pageSlug available')
        .sort({ variantCode: 1 })
        .lean()
    ]);
    if (!specCat) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({
      ok: true,
      specificCategory: {
        _id: specCat._id,
        code: specCat.specificCategoryCode,
        useLetterMapping: specCat.useLetterMapping,
        letterMappingGroups: specCat.letterMappingGroups || []
      },
      variants,
    });
  } catch (err) {
    console.error('[variants/by-specific-category] error', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
