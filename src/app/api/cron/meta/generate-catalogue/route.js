// app/api/cron/meta/generate-catalogue/route.js
// HIT: /api/cron/meta/generate-catalogue

import connectToDatabase from '@/lib/middleware/connectToDb';
import { getGoogleCategoryFromProduct, GOOGLE_TAXONOMY_IDS } from '@/lib/google/categoryMapping';
import { buildProductImageGallery, buildOptionImageGallery, extractImagesFromBlocks } from '@/lib/utils/productImages';
import { buildShoppingTitle, buildShoppingDescription, buildOptionShoppingTitle } from '@/lib/utils/shoppingTitles';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import ProductInfoTab from '@/models/ProductInfoTab';
import { NextResponse } from 'next/server';

// Set maximum timeout to 5 minutes for this cron API (Vercel will auto-stop after this)
export const maxDuration = 300;

// Concurrency settings for parallel processing
const BATCH_SIZE = 100; // Products per batch
const CONCURRENCY_LIMIT = 20; // Parallel product processing

export async function GET() {
  const startTime = Date.now();
  let currentCycle = null;
  
  try {
    await connectToDatabase();

    // Cleanup: Delete old cycles (keep only last 2)
    await cleanupOldCycles();

    // Simple logic:
    // 1. If there's an in-progress cycle, continue it
    // 2. Otherwise, always start a NEW cycle (even if last was completed)
    currentCycle = await CatalogueCycle.findOne({ 
      status: 'in_progress' 
    }).sort({ startedAt: -1 });

    if (!currentCycle) {
      // Start a fresh new cycle
      currentCycle = new CatalogueCycle({
        startedAt: new Date(),
        status: 'in_progress',
        processedCount: 0,
      });
      await currentCycle.save();
      console.log(`[Catalogue] Started NEW cycle: ${currentCycle._id}`);
    } else {
      console.log(`[Catalogue] Continuing existing cycle: ${currentCycle._id}`);
    }

    // Preload all category data into maps for O(1) lookup
    const allSpecificCategories = await SpecificCategory.find({})
      .select('_id name available inventoryMode commonProductCardImages commonGalleryImages showDescriptionImagesInGallery')
      .lean();
    const availableCategoryIdSet = new Set(
      allSpecificCategories.filter(cat => cat.available).map(cat => cat._id.toString())
    );
    const categoryDataMap = new Map(
      allSpecificCategories.map(cat => [cat._id.toString(), cat])
    );

    // Preload all available variants
    const availableVariants = await SpecificCategoryVariant.find({ available: true })
      .select('_id')
      .lean();
    const availableVariantIdSet = new Set(availableVariants.map(v => v._id.toString()));

    // Preload ALL ProductInfoTabs with Description title (for images)
    // Key: "variant:{id}" or "category:{id}" or "product:{id}"
    const allDescriptionTabs = await ProductInfoTab.find({ title: 'Description' })
      .select('specificCategoryVariant specificCategory product content')
      .lean();
    
    const descriptionTabMap = new Map();
    for (const tab of allDescriptionTabs) {
      if (tab.specificCategoryVariant) {
        descriptionTabMap.set(`variant:${tab.specificCategoryVariant.toString()}`, tab);
      }
      if (tab.specificCategory) {
        descriptionTabMap.set(`category:${tab.specificCategory.toString()}`, tab);
      }
      if (tab.product) {
        descriptionTabMap.set(`product:${tab.product.toString()}`, tab);
      }
    }

    // Get products already processed in THIS cycle
    const processedProductIds = await Catalogue.distinct('productId', { 
      cycleId: currentCycle._id,
      processed: true,
      optionId: { $exists: false }
    });
    const processedIdSet = new Set(processedProductIds.map(id => id.toString()));

    // Get ALL products (with available categories)
    const allCategoryIds = allSpecificCategories.map(cat => cat._id);
    const allProducts = await Product.find({
      specificCategory: { $in: allCategoryIds },
    })
      .populate('specificCategoryVariant')
      .populate('inventoryData')
      .lean();

    // Filter to only unprocessed products in THIS cycle
    const unprocessedProducts = allProducts.filter(p => !processedIdSet.has(p._id.toString()));
    
    console.log(`[Catalogue] Cycle ${currentCycle._id}: ${unprocessedProducts.length} products to process (${processedProductIds.length} already done in this cycle)`);

    if (unprocessedProducts.length === 0) {
      // All products processed in this cycle - mark complete
      currentCycle.status = 'completed';
      currentCycle.completedAt = new Date();
      currentCycle.processedCount = processedProductIds.length;
      await currentCycle.save();
      
      return NextResponse.json({
        success: true,
        message: 'Catalogue cycle completed! All products processed. Hit again to start a new cycle.',
        cycleId: currentCycle._id,
        cycleStatus: 'completed',
        totalProcessed: processedProductIds.length,
        processingTimeSeconds: (Date.now() - startTime) / 1000,
        hint: 'Next request will start a fresh cycle'
      });
    }

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process in batches with concurrency
    for (let i = 0; i < unprocessedProducts.length; i += BATCH_SIZE) {
      const batch = unprocessedProducts.slice(i, i + BATCH_SIZE);
      
      // Process batch with controlled concurrency
      const results = await processWithConcurrency(
        batch,
        CONCURRENCY_LIMIT,
        async (product) => {
          try {
            return await processProduct(
              product,
              currentCycle._id,
              availableCategoryIdSet,
              availableVariantIdSet,
              categoryDataMap,
              descriptionTabMap
            );
          } catch (error) {
            console.error(`Error processing product ${product._id}:`, error.message);
            return { updated: 0, skipped: 0, error: true };
          }
        }
      );

      // Aggregate results
      for (const result of results) {
        totalUpdated += result.updated || 0;
        totalSkipped += result.skipped || 0;
        if (result.error) totalErrors++;
      }

      // Update cycle progress periodically
      currentCycle.processedCount = processedProductIds.length + i + batch.length;
      await currentCycle.save();
    }

    const processingTime = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      message: 'Catalogue generation batch processed',
      cycleId: currentCycle._id,
      cycleStatus: currentCycle.status,
      totalUpdated,
      totalSkipped,
      totalErrors,
      processedThisRun: unprocessedProducts.length,
      totalProcessed: processedProductIds.length + unprocessedProducts.length,
      processingTimeSeconds: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in catalogue generation cron:', error);

    if (currentCycle) {
      try {
        await CatalogueCycle.findByIdAndUpdate(currentCycle._id, {
          $push: {
            processingErrors: {
              message: error.message,
              timestamp: new Date(),
            }
          }
        });
      } catch (updateError) {
        console.error('Error updating cycle with error info:', updateError);
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}

/**
 * Process items with controlled concurrency (like Promise.all but limited)
 */
async function processWithConcurrency(items, limit, processor) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    results.push(promise);
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Process a single product and its options
 */
async function processProduct(
  product,
  cycleId,
  availableCategoryIdSet,
  availableVariantIdSet,
  categoryDataMap,
  descriptionTabMap
) {
  let updated = 0;
  let skipped = 0;

  // Check availability
  const isCategoryAvailable = availableCategoryIdSet.has(product.specificCategory?.toString());
  const isVariantAvailable = !product.specificCategoryVariant || 
    availableVariantIdSet.has(product.specificCategoryVariant._id?.toString());
  const isProductAvailable = product.available !== false;

  if (!isCategoryAvailable || !isVariantAvailable || !isProductAvailable) {
    // Mark as processed but skipped (unavailable)
    await Catalogue.findOneAndUpdate(
      { cycleId, productId: product._id, optionId: { $exists: false } },
      { cycleId, productId: product._id, processed: true, skipped: true },
      { upsert: true }
    );
    return { updated: 0, skipped: 1 };
  }

  // Get category data
  const categoryData = categoryDataMap.get(product.specificCategory?.toString());
  const inventoryMode = categoryData?.inventoryMode || 'on-demand';

  // Determine stock status
  let isInStock = true;
  if (inventoryMode === 'inventory') {
    const availableQty = product.inventoryData?.availableQuantity;
    if (typeof availableQty === 'number' && availableQty <= 0) {
      isInStock = false;
    }
  }

  // Get description images - check all three levels (product > variant > category)
  const descriptionImages = getDescriptionImages(
    product,
    descriptionTabMap,
    categoryData?.showDescriptionImagesInGallery
  );

  // Create main product feed data
  const feedData = createFeedData(
    product, 
    isInStock, 
    product.specificCategoryVariant, 
    categoryData, 
    descriptionImages
  );

  await Catalogue.findOneAndUpdate(
    { cycleId, productId: product._id, optionId: { $exists: false } },
    { cycleId, productId: product._id, feedData, processed: true },
    { upsert: true }
  );
  updated++;

  // Process options if available
  if (product.optionsAvailable) {
    const options = await Option.find({ product: product._id })
      .populate('inventoryData')
      .lean();

    for (const option of options) {
      let isOptionInStock = true;
      if (inventoryMode === 'inventory') {
        const optionQty = option.inventoryData?.availableQuantity;
        if (typeof optionQty === 'number' && optionQty <= 0) {
          isOptionInStock = false;
        }
      }

      const optionFeedData = createFeedDataForOption(
        product, 
        option, 
        isOptionInStock, 
        product.specificCategoryVariant, 
        categoryData, 
        descriptionImages
      );

      await Catalogue.findOneAndUpdate(
        { cycleId, productId: product._id, optionId: option._id },
        { cycleId, productId: product._id, optionId: option._id, feedData: optionFeedData, processed: true },
        { upsert: true }
      );
      updated++;
    }
  }

  return { updated, skipped };
}

/**
 * Get description images from ProductInfoTab - checks product, variant, and category levels
 */
function getDescriptionImages(product, descriptionTabMap, showDescriptionImagesInGallery) {
  if (!showDescriptionImagesInGallery) {
    return [];
  }

  // Priority: product-level > variant-level > category-level
  const productTab = descriptionTabMap.get(`product:${product._id.toString()}`);
  if (productTab?.content?.blocks) {
    return extractImagesFromBlocks(productTab.content.blocks);
  }

  const variantId = product.specificCategoryVariant?._id?.toString();
  if (variantId) {
    const variantTab = descriptionTabMap.get(`variant:${variantId}`);
    if (variantTab?.content?.blocks) {
      return extractImagesFromBlocks(variantTab.content.blocks);
    }
  }

  const categoryId = product.specificCategory?.toString();
  if (categoryId) {
    const categoryTab = descriptionTabMap.get(`category:${categoryId}`);
    if (categoryTab?.content?.blocks) {
      return extractImagesFromBlocks(categoryTab.content.blocks);
    }
  }

  return [];
}

/**
 * Cleanup old catalogue cycles - keep only the last 2 cycles
 * Deletes both the CatalogueCycle and all associated Catalogue entries
 */
async function cleanupOldCycles() {
  try {
    // Get all cycles sorted by startedAt descending
    const allCycles = await CatalogueCycle.find({})
      .sort({ startedAt: -1 })
      .select('_id startedAt status')
      .lean();

    // Keep the last 2 cycles, delete the rest
    if (allCycles.length <= 2) {
      return; // Nothing to cleanup
    }

    const cyclesToDelete = allCycles.slice(2); // All except first 2
    const cycleIdsToDelete = cyclesToDelete.map(c => c._id);

    if (cycleIdsToDelete.length > 0) {
      // Delete all Catalogue entries for these cycles
      const catalogueDeleteResult = await Catalogue.deleteMany({
        cycleId: { $in: cycleIdsToDelete }
      });

      // Delete the cycles themselves
      const cycleDeleteResult = await CatalogueCycle.deleteMany({
        _id: { $in: cycleIdsToDelete }
      });

      console.log(`[Catalogue Cleanup] Deleted ${cycleDeleteResult.deletedCount} old cycles and ${catalogueDeleteResult.deletedCount} catalogue entries`);
    }
  } catch (error) {
    console.error('[Catalogue Cleanup] Error:', error.message);
    // Don't throw - cleanup failure shouldn't stop the main process
  }
}

/**
 * Create feed data for a main product
 * @param {Object} product - The product object
 * @param {boolean} isAvailable - Whether the product is in stock
 * @param {Object} variant - The variant object (populated specificCategoryVariant)
 * @param {Object} category - The category object (specificCategory data)
 * @param {string[]} descriptionImages - Images extracted from ProductInfoTab description
 */
function createFeedData(product, isAvailable = true, variant = null, category = null, descriptionImages = []) {
  const baseUrl = 'https://www.maddycustom.com';
  
  // Build images using the utility (matches ImageGallery component logic)
  const { imageLink, additionalImageLinks } = buildProductImageGallery(product, variant, category, descriptionImages);

  // Build SEO-optimized title and description for Google Shopping
  const title = buildShoppingTitle(product, variant, category);
  const description = buildShoppingDescription(product, variant, category);

  // Determine google product category using utility (uses specificCategory for accurate mapping)
  const googleProductCategory = getGoogleCategoryFromProduct(product);

  const feedData = {
    id: product._id.toString(),
    title: title.substring(0, 150),
    description: description.substring(0, 5000),
    availability: isAvailable ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`,
    price_amount: product.price,
    price_currency: 'INR',
    sale_price_amount: (product.MRP && product.MRP > product.price) ? product.price : undefined,
    sale_price_currency: (product.MRP && product.MRP > product.price) ? 'INR' : undefined,
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageLink,
    brand: 'Maddy Custom',
    google_product_category: googleProductCategory,
    additional_image_links: additionalImageLinks,
    custom_attributes: [
      { name: 'category', value: product.category },
      { name: 'subcategory', value: product.subCategory }
    ],
    content_language: 'en',
    target_country: 'IN',
    channel: 'online',
    feed_label: 'IN'
  };
  return feedData;
}

/**
 * Create feed data for a product option
 * @param {Object} product - The product object
 * @param {Object} option - The option object
 * @param {boolean} isAvailable - Whether the product (and its variant/category) is fully available
 * @param {Object} variant - The variant object (populated specificCategoryVariant)
 * @param {Object} category - The category object (specificCategory data)
 * @param {string[]} descriptionImages - Images extracted from ProductInfoTab description
 */
function createFeedDataForOption(product, option, isAvailable = true, variant = null, category = null, descriptionImages = []) {
  const baseUrl = 'https://www.maddycustom.com';
  
  // Build images using the utility (matches ImageGallery component logic)
  const { imageLink, additionalImageLinks } = buildOptionImageGallery(product, option, variant, category, descriptionImages);

  // Build SEO-optimized title and description for Google Shopping
  const title = buildOptionShoppingTitle(product, option, variant, category);
  const description = buildShoppingDescription(product, variant, category);

  // Determine google product category using utility (uses specificCategory for accurate mapping)
  const googleProductCategory = getGoogleCategoryFromProduct(product);

  const feedData = {
    id: `${product._id}-${option._id}`,
    title: title.substring(0, 150),
    description: description.substring(0, 5000),
    availability: isAvailable ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`,
    price_amount: product.price,
    price_currency: 'INR',
    sale_price_amount: (product.MRP && product.MRP > product.price) ? product.price : undefined,
    sale_price_currency: (product.MRP && product.MRP > product.price) ? 'INR' : undefined,
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageLink,
    brand: 'Maddy Custom',
    google_product_category: googleProductCategory,
    additional_image_links: additionalImageLinks,
    custom_attributes: [
      { name: 'category', value: product.category },
      { name: 'subcategory', value: product.subCategory }
    ],
    content_language: 'en',
    target_country: 'IN',
    channel: 'online',
    feed_label: 'IN'
  };
  return feedData;
}
