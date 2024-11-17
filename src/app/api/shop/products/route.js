// pages/api/shop/products/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory'; // Import SpecificCategory
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.info("Received request to /api/shop/products with POST method");

    let { slug } = await request.json();
    slug = '/' + slug;

    if (!slug) {
      console.error("Request missing 'slug' parameter");
      return NextResponse.json({ message: 'Slug is required.' }, { status: 400 });
    }

    await connectToDatabase();
    console.info("Connected to the database successfully");

    // Attempt to find Product by pageSlug first
    const product = await Product.findOne({ pageSlug: slug }).lean().exec();

    if (product) {      
      // Fetch the associated SpecificCategoryVariant if it exists
      const variant = await SpecificCategoryVariant.findById(product.specificCategoryVariant).lean().exec();

      if (!variant) {
        console.warn(`No SpecificCategoryVariant found for product: ${product.name}`);
        return NextResponse.json({ message: 'Variant Not Found' }, { status: 404 });
      }

      // Fetch the associated SpecificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

      if (!specificCategory) {
        console.warn(`No SpecificCategory found for variant: ${variant.name}`);
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      return NextResponse.json(
        { type: 'product', product, variant, specificCategory },
        { status: 200 }
      );
    }

    // If no product found, check for SpecificCategoryVariant by pageSlug
    const variant = await SpecificCategoryVariant.findOne({ pageSlug: slug }).lean().exec();

    if (variant) {
      console.info(`Found SpecificCategoryVariant: ${variant.name}`);

      // Fetch the associated SpecificCategory
      const specificCategory = await SpecificCategory.findById(variant.specificCategory).lean().exec();

      if (!specificCategory) {
        console.warn(`No SpecificCategory found for variant: ${variant.name}`);
        return NextResponse.json({ message: 'Specific Category Not Found' }, { status: 404 });
      }

      const products = await Product.find({ specificCategoryVariant: variant._id })
        .sort({ displayOrder: 1 }) // Default sorting by displayOrder
        .lean()
        .exec();

      return NextResponse.json(
        { type: 'variant', variant, products, specificCategory },
        { status: 200 }
      );
    }

    // Neither variant nor product found, return 404
    console.warn(`No SpecificCategoryVariant or Product found for slug: ${slug}`);
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
