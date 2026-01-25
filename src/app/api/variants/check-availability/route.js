import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';

export const revalidate = 300; // Cache for 5 minutes

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId');

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if variant exists and is available
    const variant = await SpecificCategoryVariant.findById(variantId)
      .populate('specificCategory', 'available')
      .lean();

    if (!variant) {
      return NextResponse.json(
        { available: false, reason: 'Variant not found' },
        { status: 404 }
      );
    }

    // Check if both variant and its category are available
    const isAvailable = 
      variant.available === true && 
      variant.specificCategory?.available === true;

    return NextResponse.json({
      available: isAvailable,
      variantId: variant._id,
      variantName: variant.name,
      variantCode: variant.variantCode,
    });

  } catch (error) {
    console.error('Error checking variant availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', available: false },
      { status: 500 }
    );
  }
}
