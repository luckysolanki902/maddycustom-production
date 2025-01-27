

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';
import js2xmlparser from 'js2xmlparser'; // Import the XML parser

/**
 * GET /api/products
 * 
 * Retrieves all products with specificCategoryCode of 'win', 'bw', or 'tw',
 * transforms the data into XML, and returns it as an XML response.
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

    // Transform the product data to match the XML requirements
    const xmlProducts = products.map(product => ({
      id: product.sku,
      title: product.title,
      description: product.specificCategoryVariant && product.specificCategoryVariant.productDescription
        ? product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name)
        : '',
      availability: 'in stock', // Static value as per requirements
      condition: 'new',         // Static value as per requirements
      price: product.price,
      link: `https://www.maddycustom.com/shop${product.pageSlug}`,
      image_link: product.images[0]
        ? `https://d26w01jhwuuxpo.cloudfront.net${product.images[0]}`
        : '',
      brand: 'Maddy Custom', // Static value as per requirements
    }));

    // Define the root element and its structure for the XML
    const xmlOptions = {
      declaration: { encoding: 'UTF-8' },
      format: {
        doubleQuotes: true
      }
    };

    // Convert the JSON data to XML
    const xmlData = js2xmlparser.parse("products", { product: xmlProducts }, xmlOptions);

    // Return the XML as a response
    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error generating XML:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
