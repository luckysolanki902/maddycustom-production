// src/app/api/cron/meta/generate-catalogue/route.js
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import Inventory from '@/models/Inventory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import SpecificCategory from '@/models/SpecificCategory';

export async function GET(request) {
  try {
    await runCatalogueUpdate();
    return NextResponse.json({ message: 'Batched catalogue update completed.' });
  } catch (error) {
    console.error('Batched catalogue update failed:', error);
    return NextResponse.json(
      { error: 'Batched catalogue update failed: ' + error.message },
      { status: 500 }
    );
  }
}

async function runCatalogueUpdate() {
  // 1) Connect to the database
  await connectToDatabase();
  const now = new Date();

  // Limits for batch processing
  const PRODUCT_BATCH_SIZE = 100; // Number of products to fetch
  const GLOBAL_FEED_LIMIT = 100;   // Max feed entries created per API call

  // 2) Retrieve an active (in_progress) cycle or create one
  let cycle = await CatalogueCycle.findOne({ status: 'in_progress' });
  if (!cycle) {
    cycle = await CatalogueCycle.create({
      startedAt: now,
      status: 'in_progress',
      lastProcessedIndex: 0,
      processedCount: 0,
    });
  }

  // 3) Fetch a page of products that are "available"
  const products = await Product.find({ available: true })
    .sort({ _id: 1 }) // consistent order
    .skip(cycle.lastProcessedIndex)
    .limit(PRODUCT_BATCH_SIZE)
    .populate('inventoryData')
    .populate('specificCategoryVariant')
    .lean();

  let feedEntriesCreated = 0;
  let fullyProcessedCount = 0;

  // 4) Process each product
  for (const product of products) {
    // Respect global limit: if we already created 1000 feed entries this run, stop
    if (feedEntriesCreated >= GLOBAL_FEED_LIMIT) break;

    // Check if this product is already in the catalogue for this cycle
    const existing = await Catalogue.findOne({
      cycleId: cycle._id,
      productId: product._id,
    });
    if (existing) {
      // Already processed, skip
      fullyProcessedCount++;
      continue;
    }

    // We are about to create a brand-new entry for this product
    // 4a) Determine best option, if any
    const options = await Option.find({ product: product._id })
      .populate('inventoryData')
      .lean();

    let selectedOptionId = null;
    let availability = 'in stock'; // default on-demand
    let bestImage = '';
    let description = '';

    // Best image from product
    if (product.images && product.images.length > 0) {
      bestImage =
        'https://d26w01jhwuuxpo.cloudfront.net' +
        (product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0]);
    }

    if (
      product.specificCategoryVariant &&
      product.specificCategoryVariant.productDescription
    ) {
      description = product.specificCategoryVariant.productDescription.replace(
        '{uniqueName}',
        product.name || ''
      );
    }

    if (options.length > 0) {
      // Sort options by highest quantity, treating undefined inventory as on-demand (Infinity)
      options.sort((a, b) => {
        const qtyA =
          a.inventoryData && typeof a.inventoryData.availableQuantity === 'number'
            ? a.inventoryData.availableQuantity
            : Infinity;
        const qtyB =
          b.inventoryData && typeof b.inventoryData.availableQuantity === 'number'
            ? b.inventoryData.availableQuantity
            : Infinity;
        return qtyB - qtyA; // descending
      });

      const bestOption = options[0];
      selectedOptionId = bestOption._id;

      // availability
      if (
        bestOption.inventoryData &&
        typeof bestOption.inventoryData.availableQuantity === 'number'
      ) {
        if (bestOption.inventoryData.availableQuantity <= 0) {
          availability = 'out of stock';
        }
      }
    } else {
      // No options => check product's inventory
      if (
        product.inventoryData &&
        typeof product.inventoryData.availableQuantity === 'number'
      ) {
        if (product.inventoryData.availableQuantity <= 0) {
          availability = 'out of stock';
        }
      }
    }

    // 4b) Build feed data
    const feedData = {
      id: product._id.toString(),
      title: product.title,
      description,
      availability,
      condition: 'new',
      price: `${product.price} INR`,
      link: `https://www.maddycustom.com/shop${product.pageSlug}`,
      image_link: bestImage,
      brand: 'Maddy Custom',
    };

    // 4c) Create the catalogue entry
    await Catalogue.create({
      cycleId: cycle._id,
      productId: product._id,
      optionId: selectedOptionId, // optional, used if we picked an option
      feedData,
      processed: true,
    });

    feedEntriesCreated++;
    fullyProcessedCount++;
  }

  // 5) Update cycle pointer and counts
  cycle.lastProcessedIndex += fullyProcessedCount;
  cycle.processedCount += feedEntriesCreated;

  // If we fetched fewer products than the batch size, no more products remain => mark done
  if (products.length < PRODUCT_BATCH_SIZE) {
    cycle.status = 'completed';
    console.log('Cycle completed.');
  }
  await cycle.save();
}
