// /app/api/products-xml/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import { NextResponse } from 'next/server';
import { create } from 'xmlbuilder2';

/**
 * GET /api/products-xml
 * 
 * Retrieves all products with specificCategoryCode of 'win', 'bw', or 'tw',
 * transforms the data into XML format as per Facebook's RSS XML specifications,
 * and returns it as an XML response.
 */
export async function GET() {
  try {
    // Establish a connection to the database
    await connectToDatabase();

    // Define the specificCategoryCodes to filter
    const specificCategoryCodes = ['win', 'bw', 'tw'];

    // Fetch SpecificCategory documents matching the specified codes
    const specificCategories = await SpecificCategory.find({
      specificCategoryCode: { $in: specificCategoryCodes },
    }).select('_id'); // Select only the _id field for efficiency

    // Extract the IDs of the matched SpecificCategories
    const specificCategoryIds = specificCategories.map(cat => cat._id);

    // Fetch Products that belong to the matched SpecificCategories
    const products = await Product.find({
      specificCategory: { $in: specificCategoryIds },
      available: true, // Assuming you only want available products
    })
      .populate('specificCategoryVariant') // Populate the specificCategoryVariant field
      .lean(); // Use lean() for faster Mongoose queries by returning plain JavaScript objects

    // Transform the product data to include only required fields
    const xmlProducts = products.map(product => ({
      'g:id': product._id,
      'g:title': product.title,
      'g:description': product.specificCategoryVariant && product.specificCategoryVariant.productDescription
        ? product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name)
        : '',
      'g:availability': 'in stock', // Static value as per requirements
      'g:condition': 'new',         // Static value as per requirements
      'g:price': `${product.price} INR`, // Ensure format: number + space + currency code
      'g:link': `https://www.maddycustom.com/shop${product.pageSlug}`,
      'g:image_link': product.images[0]
        ? `https://d26w01jhwuuxpo.cloudfront.net${product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0]}`
        : '',
      'g:brand': 'Maddy Custom', // Static value as per requirements
    }));

    // Build the XML structure using xmlbuilder2
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('rss', {
        version: '2.0',
        'xmlns:g': 'http://base.google.com/ns/1.0',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
      });

    const channel = root.ele('channel');
    channel.ele('title').txt('My Deal Shop Products');
    channel.ele('description').txt('Product Feed for Facebook');
    channel.ele('link').txt('https://www.mydealsshop.foo');
    channel.ele('atom:link', {
      href: 'https://www.mydealsshop.foo/pages/test-feed',
      rel: 'self',
      type: 'application/rss+xml',
    }).up();

    // Append each product as an item
    xmlProducts.forEach(prod => {
      const item = channel.ele('item');
      for (const [key, value] of Object.entries(prod)) {
        item.ele(key).txt(value).up();
      }
      item.up();
    });

    // Finalize the XML
    const xmlData = root.end({ prettyPrint: true });

    // Return the XML as a response
    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml',
        // Removed 'Content-Disposition' to allow direct fetching by Facebook
      },
    });
  } catch (error) {
    console.error('Error generating XML:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
