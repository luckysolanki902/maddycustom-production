// src/app/api/cron/meta/generate-catalogue/route.js

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import SpecificCategory from '@/models/SpecificCategory';
import InventoryData from '@/models/Inventory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';

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
  await connectToDatabase();
  const now = new Date();

  const PRODUCT_BATCH_SIZE = 100;
  const GLOBAL_FEED_LIMIT  = 1000;

  // 1) Get or create an in-progress cycle
  let cycle = await CatalogueCycle.findOne({ status: 'in_progress' });
  if (!cycle) {
    cycle = await CatalogueCycle.create({
      startedAt: now,
      status: 'in_progress',
      lastProcessedIndex: 0,
      processedCount: 0,
    });
  }

  // 2) Fetch one batch of products, plus their specificCategory.available flag
  const rawProducts = await Product.find({ available: true })
    .sort({ _id: 1 })
    .skip(cycle.lastProcessedIndex)
    .limit(PRODUCT_BATCH_SIZE)
    .populate('inventoryData')
    .populate('specificCategory', 'available')          // <-- populate only `available`
    .populate('specificCategoryVariant')
    .lean();

  // 3) Skip those whose specificCategory.available is false
  const products = rawProducts.filter(
    p => !p.specificCategory || p.specificCategory.available
  );

  let feedEntriesCreated    = 0;
  let fullyProcessedCount   = 0;

  for (const product of products) {
    if (feedEntriesCreated >= GLOBAL_FEED_LIMIT) break;

    // skip if already in this cycle
    const exists = await Catalogue.findOne({
      cycleId:    cycle._id,
      productId:  product._id,
    });
    if (exists) {
      fullyProcessedCount++;
      continue;
    }

    // determine best image & description
    const bestImage = product.images?.[0]
      ? 'https://d26w01jhwuuxpo.cloudfront.net' +
        (product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0])
      : '';
    const description = product.specificCategoryVariant?.productDescription
      ? product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name)
      : '';

    // pick best option if any
    const options = await Option.find({ product: product._id })
      .populate('inventoryData')
      .lean();
    let availability    = 'in stock';
    let selectedOptionId = null;
    if (options.length) {
      options.sort((a, b) => {
        const qa = a.inventoryData?.availableQuantity;
        const qb = b.inventoryData?.availableQuantity;
        const avA = typeof qa === 'number' ? qa : Infinity;
        const avB = typeof qb === 'number' ? qb : Infinity;
        return avB - avA;
      });
      const bestOpt = options[0];
      selectedOptionId = bestOpt._id;
      if (typeof bestOpt.inventoryData?.availableQuantity === 'number' &&
          bestOpt.inventoryData.availableQuantity <= 0) {
        availability = 'out of stock';
      }
    } else {
      const invQty = product.inventoryData?.availableQuantity;
      if (typeof invQty === 'number' && invQty <= 0) {
        availability = 'out of stock';
      }
    }

    // build feedData
    const feedData = {
      id:           product._id.toString(),
      title:        product.title,
      description,
      availability,
      condition:    'new',
      price:        `${product.price} INR`,
      link:         `https://www.maddycustom.com/shop${product.pageSlug}`,
      image_link:   bestImage,
      brand:        'Maddy Custom',
    };

    // create catalogue entry
    await Catalogue.create({
      cycleId:   cycle._id,
      productId: product._id,
      optionId:  selectedOptionId,
      feedData,
      processed: true,
    });

    feedEntriesCreated++;
    fullyProcessedCount++;
  }

  // 4) Advance cycle pointer and counts
  cycle.lastProcessedIndex += fullyProcessedCount;
  cycle.processedCount      += feedEntriesCreated;

  // 5) If fewer raw products fetched than batch, we’re done
  if (rawProducts.length < PRODUCT_BATCH_SIZE) {
    cycle.status = 'completed';
    console.log('Cycle completed.');
  }
  await cycle.save();
}
