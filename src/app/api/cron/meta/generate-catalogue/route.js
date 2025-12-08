// app/api/cron/meta/generate-catalogue/route.js
// HIT: /api/cron/meta/generate-catalogue

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

// Set maximum timeout to 5 minutes for this cron API
export const maxDuration = 300; // 5 minutes in seconds

export async function GET() {
  const startTime = Date.now();
  let currentCycle = null;
  
  try {
    // 1. Connect to database
    await connectToDatabase();

    // 2. Get or create current catalogue cycle
    currentCycle = await CatalogueCycle.findOne({ 
      status: 'in_progress' 
    }).sort({ startedAt: -1 });

    if (!currentCycle) {
      currentCycle = new CatalogueCycle({
        startedAt: new Date(),
        status: 'in_progress',
        lastProcessedIndex: 0,
        processedCount: 0,
      });
      await currentCycle.save();
    }

    // 4. Get ALL specific categories with available and inventoryMode fields
    const allSpecificCategories = await SpecificCategory.find({}).select('_id available inventoryMode').lean();
    const availableCategoryIds = allSpecificCategories.filter(cat => cat.available).map(cat => cat._id);
    const allCategoryIds = allSpecificCategories.map(cat => cat._id);
    const availableCategoryIdSet = new Set(availableCategoryIds.map(id => id.toString()));
    // Map categoryId -> inventoryMode for quick lookup
    const categoryInventoryModeMap = new Map(allSpecificCategories.map(cat => [cat._id.toString(), cat.inventoryMode || 'on-demand']));

    // 5. Get products that need updating (batch processing for performance)
    const batchSize = 50; // Process 50 products at a time
    const maxProcessingTime = 4.5 * 60 * 1000; // 4.5 minutes max processing time
    
    let processedInThisCycle = 0;
    let totalUpdated = 0;
    let currentIndex = currentCycle.lastProcessedIndex;

    // Get available variant IDs for filtering
    const availableVariants = await SpecificCategoryVariant.find({
      available: true,
    }).select('_id').lean();
    const availableVariantIdSet = new Set(availableVariants.map(v => v._id.toString()));

    while (Date.now() - startTime < maxProcessingTime) {
      // Get next batch of products (ALL products to properly handle unavailable ones)
      const products = await Product.find({
        specificCategory: { $in: allCategoryIds },
      })
        .populate('specificCategoryVariant')
        .populate('inventoryData')
        .skip(currentIndex)
        .limit(batchSize)
        .lean();

      if (products.length === 0) {
        // No more products to process, cycle complete
        currentCycle.status = 'completed';
        await currentCycle.save();
        break;
      }

      // Process each product in the batch
      for (const product of products) {
        try {
          // Check if product needs updating
          const existingCatalogueEntry = await Catalogue.findOne({
            cycleId: currentCycle._id,
            productId: product._id,
            optionId: { $exists: false }, // Main product entry
          }).lean();

          let shouldUpdate = true;
          if (existingCatalogueEntry) {
            // Only update if product was updated after last fetch
            const lastFetchDate = existingCatalogueEntry.updatedAt;
            const productUpdateDate = new Date(product.updatedAt);
            shouldUpdate = productUpdateDate > lastFetchDate;
          }

          // Check if category is available
          const isCategoryAvailable = availableCategoryIdSet.has(product.specificCategory.toString());
          
          // Check if variant is available
          const isVariantAvailable = !product.specificCategoryVariant || 
            availableVariantIdSet.has(product.specificCategoryVariant._id?.toString());
          
          // Check if product itself is available
          const isProductAvailable = product.available !== false;
          
          // SKIP entirely if category, variant, OR product is unavailable
          // Don't create catalogue entry at all - these products shouldn't appear in feeds
          if (!isCategoryAvailable || !isVariantAvailable || !isProductAvailable) {
            // Skip this product entirely - it's discontinued/unavailable
            processedInThisCycle++;
            continue;
          }
          
          // At this point: category, variant, and product are ALL available
          // Get inventory mode for this category (on-demand or inventory)
          const inventoryMode = categoryInventoryModeMap.get(product.specificCategory.toString()) || 'on-demand';
          
          // Determine if product is in stock based on inventory mode
          let isInStock = true; // Default: in stock for on-demand
          if (inventoryMode === 'inventory') {
            // For inventory-based categories, check availableQuantity
            const availableQty = product.inventoryData?.availableQuantity;
            // Only mark as out of stock if inventory tracking shows 0 or less
            if (typeof availableQty === 'number' && availableQty <= 0) {
              isInStock = false;
            }
          }
          // For on-demand categories, isInStock stays true (always in stock when available)

          if (shouldUpdate) {
            // Create/update main product catalogue entry
            // isInStock is already determined based on inventoryMode
            const feedData = createFeedData(product, isInStock);
            
            await Catalogue.findOneAndUpdate(
              {
                cycleId: currentCycle._id,
                productId: product._id,
                optionId: { $exists: false },
              },
              {
                cycleId: currentCycle._id,
                productId: product._id,
                feedData,
                processed: true,
              },
              { upsert: true, new: true }
            );

            totalUpdated++;
          }

          // Process product options if they exist
          if (product.optionsAvailable) {
            const options = await Option.find({ product: product._id }).populate('inventoryData').lean();
            
            for (const option of options) {
              const existingOptionEntry = await Catalogue.findOne({
                cycleId: currentCycle._id,
                productId: product._id,
                optionId: option._id,
              }).lean();

              let shouldUpdateOption = true;
              if (existingOptionEntry) {
                const lastFetchDate = existingOptionEntry.updatedAt;
                const optionUpdateDate = new Date(option.updatedAt);
                const productUpdateDate = new Date(product.updatedAt);
                // Update if either product or option was updated
                shouldUpdateOption = optionUpdateDate > lastFetchDate || productUpdateDate > lastFetchDate;
              }

              // Determine option availability based on inventory mode
              // Since we already checked product/category/variant availability above,
              // we know the product is available. Now just check option inventory.
              let isOptionInStock = true; // Default: in stock for on-demand
              if (inventoryMode === 'inventory') {
                // For inventory-based categories, check option's availableQuantity
                const optionAvailableQty = option.inventoryData?.availableQuantity;
                if (typeof optionAvailableQty === 'number' && optionAvailableQty <= 0) {
                  isOptionInStock = false;
                }
              }
              // For on-demand: isOptionInStock stays true (always in stock)

              if (shouldUpdateOption) {
                const optionFeedData = createFeedDataForOption(product, option, isOptionInStock);
                
                await Catalogue.findOneAndUpdate(
                  {
                    cycleId: currentCycle._id,
                    productId: product._id,
                    optionId: option._id,
                  },
                  {
                    cycleId: currentCycle._id,
                    productId: product._id,
                    optionId: option._id,
                    feedData: optionFeedData,
                    processed: true,
                  },
                  { upsert: true, new: true }
                );

                totalUpdated++;
              }
            }
          }

          processedInThisCycle++;
        } catch (productError) {
          console.error(`Error processing product ${product._id}:`, productError);
          // Continue with next product
        }
      }

      // Update cycle progress
      currentIndex += products.length;
      currentCycle.lastProcessedIndex = currentIndex;
      currentCycle.processedCount += processedInThisCycle;
      await currentCycle.save();

      processedInThisCycle = 0;

      // Check if we're running out of time
      if (Date.now() - startTime > maxProcessingTime) {
        break;
      }
    }

    const processingTime = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      message: 'Catalogue generation processed successfully',
      cycleId: currentCycle._id,
      cycleStatus: currentCycle.status,
      totalUpdated,
      lastProcessedIndex: currentCycle.lastProcessedIndex,
      processingTimeSeconds: processingTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in catalogue generation cron:', error);

    // If we have a current cycle, mark any processing errors
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
 * Create feed data for a main product
 * @param {Object} product - The product object
 * @param {boolean} isAvailable - Whether the product (and its variant/category) is fully available
 */
function createFeedData(product, isAvailable = true) {
  const baseUrl = 'https://www.maddycustom.com';
  const cdnUrl = 'https://d26w01jhwuuxpo.cloudfront.net';
  
  // Get the first image with proper URL formatting
  let imageUrl = '';
  if (product.images && product.images.length > 0) {
    const image = product.images[0];
    imageUrl = image.startsWith('/') ? `${cdnUrl}${image}` : `${cdnUrl}/${image}`;
  }

  // Create description from product variant if available
  let description = product.title || product.name || '';
  if (product.specificCategoryVariant && product.specificCategoryVariant.productDescription) {
    description = product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name);
  }

  // Determine google product category using valid Google taxonomy IDs
  // See: https://support.google.com/merchants/answer/6324436
  // Using numeric IDs as recommended by Google
  let googleProductCategory = '5613'; // Vehicles & Parts > Vehicle Parts & Accessories (default)
  
  if (product.category === 'Wraps') {
    // Vehicle Wraps: ID 8202 = Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor > Vehicle Decor > Vehicle Wraps
    googleProductCategory = '8202';
  } else if (product.category === 'Accessories') {
    // Interior fittings: ID 8233 = Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Interior Fittings
    googleProductCategory = '8233';
  }

  const feedData = {
    id: product._id.toString(),
    title: (product.title || product.name)?.substring(0,150),
    description: description.substring(0, 500),
    availability: isAvailable ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`,
    price_amount: product.price,
    price_currency: 'INR',
    // Sale price if applicable
    sale_price_amount: (product.MRP && product.MRP > product.price) ? product.price : undefined,
    sale_price_currency: (product.MRP && product.MRP > product.price) ? 'INR' : undefined,
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageUrl,
    brand: 'Maddy Custom',
    google_product_category: googleProductCategory,
    additional_image_links: Array.isArray(product.images) ? product.images.slice(1,11).map(img=> img.startsWith('/') ? `${cdnUrl}${img}` : `${cdnUrl}/${img}`) : [],
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
 */
function createFeedDataForOption(product, option, isAvailable = true) {
  const baseUrl = 'https://www.maddycustom.com';
  const cdnUrl = 'https://d26w01jhwuuxpo.cloudfront.net';
  
  // Get option image or fallback to product image
  let imageUrl = '';
  if (option.images && option.images.length > 0) {
    const image = option.images[0];
    imageUrl = image.startsWith('/') ? `${cdnUrl}${image}` : `${cdnUrl}/${image}`;
  } else if (product.images && product.images.length > 0) {
    const image = product.images[0];
    imageUrl = image.startsWith('/') ? `${cdnUrl}${image}` : `${cdnUrl}/${image}`;
  }

  // Create option title
  let optionTitle = product.title || product.name;
  if (option.optionDetails && option.optionDetails.size > 0) {
    const optionValues = Array.from(option.optionDetails.values()).join(', ');
    optionTitle += ` - ${optionValues}`;
  }

  // Create description
  let description = product.title || product.name || '';
  if (product.specificCategoryVariant && product.specificCategoryVariant.productDescription) {
    description = product.specificCategoryVariant.productDescription.replace('{uniqueName}', product.name);
  }
  if (option.optionDetails && option.optionDetails.size > 0) {
    const optionValues = Array.from(option.optionDetails.values()).join(', ');
    description += ` (${optionValues})`;
  }

  // Determine google product category using valid Google taxonomy IDs (same as base product)
  let googleProductCategory = '5613'; // Vehicles & Parts > Vehicle Parts & Accessories (default)
  if (product.category === 'Wraps') {
    googleProductCategory = '8202'; // Vehicle Wraps
  } else if (product.category === 'Accessories') {
    googleProductCategory = '8233'; // Motor Vehicle Interior Fittings
  }

  const feedData = {
    id: `${product._id}-${option._id}`,
    title: optionTitle.substring(0, 150),
    description: description.substring(0, 500),
    availability: isAvailable ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`,
    price_amount: product.price,
    price_currency: 'INR',
    sale_price_amount: (product.MRP && product.MRP > product.price) ? product.price : undefined,
    sale_price_currency: (product.MRP && product.MRP > product.price) ? 'INR' : undefined,
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageUrl,
    brand: 'Maddy Custom',
    google_product_category: googleProductCategory,
    additional_image_links: [],
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
