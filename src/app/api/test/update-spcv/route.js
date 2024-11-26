import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import PackagingBox from '@/models/PackagingBox';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

export async function GET(request) {
  try {
    await connectToDatabase();

    // Step 1: Create or retrieve the box
    const boxData = {
      name: 'cyl-black-32x8',
      dimensions: {
        length: 31,
        breadth: 8.5,
        height: 8.5,
      },
      weight: 0.23,
      capacity: 4,
    };

    let box = await PackagingBox.findOne({ name: boxData.name });

    if (!box) {
      box = await PackagingBox.create(boxData);
    }

    console.log('Packaging box created or retrieved:', box);

    // Step 2: Fetch variants and update
    const variants = await SpecificCategoryVariant.find({});
    console.log(`Found ${variants.length} variants to update.`);

    for (const variant of variants) {
      // Default weight to 0.3 if dimensions or weight is not found
      const productWeight = variant.dimensions?.weight || 0.3;

      // Update the variant
      const result = await SpecificCategoryVariant.updateOne(
        { _id: variant._id },
        {
          $set: {
            packagingDetails: {
              boxId: box._id,
              productWeight,
            },
          },
        }
      );

      console.log(
        `Updated variant with ID ${variant._id}:`,
        result
      );
    }

    return NextResponse.json(
      { message: 'Packaging details updated for all variants.', boxId: box._id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating packaging details:', error);
    return NextResponse.json(
      { error: 'Failed to update packaging details.', details: error.message },
      { status: 500 }
    );
  }
}
