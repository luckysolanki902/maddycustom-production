// /app/api/meta/pixel-products-xml/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import { NextResponse } from 'next/server';
import { create } from 'xmlbuilder2';

/**
 * GET /api/meta/pixel-products-xml
 * 
 * Retrieves products from the latest completed catalogue cycle,
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
    }).sort({ startedAt: -1 });

    if (!latestCycle) {
      return new NextResponse('No completed catalogue cycle found. Please run the catalogue generation first.', { status: 400 });
    }

    // Fetch catalogue entries from the latest completed cycle
    const catalogueEntries = await Catalogue.find({ 
      cycleId: latestCycle._id,
      processed: true 
    }).lean();

    if (catalogueEntries.length === 0) {
      return new NextResponse('No processed catalogue entries found in the latest cycle.', { status: 400 });
    }

    // Transform the catalogue feed data to XML products
    const xmlProducts = catalogueEntries.map(entry => ({
      'g:id': entry.feedData.id,
      'g:title': entry.feedData.title,
      'g:description': entry.feedData.description,
      'g:availability': entry.feedData.availability,
      'g:condition': entry.feedData.condition,
      'g:price': entry.feedData.price,
      'g:link': entry.feedData.link,
      'g:image_link': entry.feedData.image_link,
      'g:brand': entry.feedData.brand,
    }));

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
