// /app/api/meta/pixel-products-csv/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Option from '@/models/Option';
import { NextResponse } from 'next/server';
import { Parser } from 'json2csv';

export async function GET() {
  try {
    // 1) Connect to DB
    await connectToDatabase();

    // 2) Get all available SpecificCategory IDs
    const specificCategoryIds = await SpecificCategory
      .find({ available: true })
      .distinct('_id');

    // 3) Fetch Products that are "available" and belong to any of those SpecificCategory IDs
    const products = await Product.find({
      available: true,
      specificCategory: { $in: specificCategoryIds },
    })
      .populate('specificCategoryVariant')
      .lean();

    const csvData = [];

    for (const product of products) {
      // 4) See if product has any Option; if so, grab the first Option
      const firstOption = await Option.findOne({ product: product._id }).lean();

      // 5) Determine "best image"
      let bestImage = '';
      if (firstOption && firstOption.images && firstOption.images.length > 0) {
        // Use option’s first image
        bestImage =
          'https://d26w01jhwuuxpo.cloudfront.net' +
          (firstOption.images[0].startsWith('/')
            ? firstOption.images[0]
            : '/' + firstOption.images[0]);
      } else if (product.images && product.images.length > 0) {
        // Fallback to product’s first image
        bestImage =
          'https://d26w01jhwuuxpo.cloudfront.net' +
          (product.images[0].startsWith('/')
            ? product.images[0]
            : '/' + product.images[0]);
      }

      // 6) Build the description (simple {uniqueName} replacement)
      let description = '';
      if (product.specificCategoryVariant?.productDescription) {
        description = product.specificCategoryVariant.productDescription.replace(
          '{uniqueName}',
          product.name || ''
        );
      }

      // 7) Push CSV row (always "in stock")
      csvData.push({
        id: product._id,
        title: product.title,
        description,
        availability: 'in stock',
        condition: 'new',
        price: `${product.price} INR`,
        link: `https://www.maddycustom.com/shop${product.pageSlug}`,
        image_link: bestImage,
        brand: 'Maddy Custom',
      });
    }

    // 8) Define CSV columns
    const fields = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'link',
      'image_link',
      'brand',
    ];

    // 9) Convert to CSV
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    // 10) Return CSV response
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        // Omit Content-Disposition so FB can directly fetch it
      },
    });
  } catch (error) {
    console.error('Error generating CSV:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
