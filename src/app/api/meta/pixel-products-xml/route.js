// /app/api/meta/pixel-products-xml/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import SpecificCategory from '@/models/SpecificCategory';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';
import { create } from 'xmlbuilder2';

/**
 * GET /api/meta/pixel-products-xml
 * 
 * Retrieves only available (in stock) products from the latest completed catalogue cycle,
 * transforms the data into XML format as per Facebook's RSS XML specifications,
 * and returns it as an XML response.
 */
export async function GET() {
  try {
    // Establish a connection to the database
    await connectToDatabase();

    // Get the latest completed catalogue cycle
    const latestCycle = await CatalogueCycle.findOne({ 
      status: 'completed' 
    }).sort({ startedAt: -1 }).lean();

    if (!latestCycle) {
      return new NextResponse('No completed catalogue cycle found.', { status: 400 });
    }

    // Get counts for logging
    const totalInCycle = await Catalogue.countDocuments({ 
      cycleId: latestCycle._id, 
      processed: true 
    });
    const inStockCount = await Catalogue.countDocuments({ 
      cycleId: latestCycle._id, 
      processed: true, 
      'feedData.availability': 'in stock' 
    });
    const outOfStockCount = totalInCycle - inStockCount;

    // Get SpecificCategory breakdown by joining with Product
    const allSpecificCategories = await SpecificCategory.find({}).select('_id name').lean();
    const specCatNameMap = new Map(allSpecificCategories.map(c => [c._id.toString(), c.name]));

    // Get all in-stock catalogue entries with their productIds
    const inStockEntries = await Catalogue.find({ 
      cycleId: latestCycle._id, 
      processed: true,
      'feedData.availability': 'in stock'
    }).select('productId').lean();

    // Get products to find their specificCategory
    const productIds = [...new Set(inStockEntries.map(e => e.productId?.toString()).filter(Boolean))];
    const products = await Product.find({ _id: { $in: productIds } }).select('_id specificCategory').lean();
    const productSpecCatMap = new Map(products.map(p => [p._id.toString(), p.specificCategory?.toString()]));

    // Count by specificCategory
    const specCatCounts = {};
    for (const entry of inStockEntries) {
      const specCatId = productSpecCatMap.get(entry.productId?.toString());
      const specCatName = specCatId ? specCatNameMap.get(specCatId) : 'Unknown';
      specCatCounts[specCatName] = (specCatCounts[specCatName] || 0) + 1;
    }

    // Log stats
    console.log(`[Meta XML Feed] Cycle: ${latestCycle._id}`);
    console.log(`[Meta XML Feed] Total items: ${totalInCycle}, In stock: ${inStockCount}, Out of stock: ${outOfStockCount}`);
    console.log(`[Meta XML Feed] SpecificCategory breakdown:`);
    Object.entries(specCatCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`  - ${name}: ${count}`);
      });

    // Fetch only catalogue entries from the latest cycle that are in stock
    const catalogueEntries = await Catalogue.find({ 
      cycleId: latestCycle._id,
      processed: true,
      'feedData.availability': 'in stock'
    }).lean();

    if (catalogueEntries.length === 0) {
      return new NextResponse('No available catalogue entries found.', { status: 400 });
    }

    // Transform the catalogue feed data to XML products
    // Note: Using only Meta-required fields, NOT google_product_category (that's for Google Merchant only)
    const xmlProducts = catalogueEntries.map(entry => {
      const product = {
        'g:id': entry.feedData.id,
        'g:title': entry.feedData.title,
        'g:description': entry.feedData.description,
        'g:availability': entry.feedData.availability,
        'g:condition': entry.feedData.condition,
        'g:price': entry.feedData.price,
        'g:link': entry.feedData.link,
        'g:image_link': entry.feedData.image_link,
        'g:brand': entry.feedData.brand,
      };
      
      // Add additional images if available
      if (entry.feedData.additional_image_links?.length > 0) {
        product['g:additional_image_link'] = entry.feedData.additional_image_links[0];
      }
      
      return product;
    });

    // Build the XML structure using xmlbuilder2
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('rss', {
        version: '2.0',
        'xmlns:g': 'http://base.google.com/ns/1.0',
        'xmlns:atom': 'http://www.w3.org/2005/Atom',
      });

    const channel = root.ele('channel');
    channel.ele('title').txt('Maddy Custom Products');
    channel.ele('description').txt('Product Feed for Facebook from Maddy Custom');
    channel.ele('link').txt('https://www.maddycustom.com');
    channel.ele('atom:link', {
      href: 'https://www.maddycustom.com/api/meta/pixel-products-xml',
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
        'X-Catalogue-Cycle-ID': latestCycle._id.toString(),
        'X-Total-Products': xmlProducts.length.toString(),
        'X-Generated-At': new Date().toISOString(),
        // Removed 'Content-Disposition' to allow direct fetching by Facebook
      },
    });
  } catch (error) {
    console.error('Error generating XML:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
