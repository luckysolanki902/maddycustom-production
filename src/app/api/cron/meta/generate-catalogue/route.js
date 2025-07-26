// app/api/cron/meta/generate-catalogue/route.js

import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Catalogue from '@/models/meta/Catalogue';
import CatalogueCycle from '@/models/meta/CatalogueCycle';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import { NextResponse } from 'next/server';

// Set maximum timeout to 5 minutes for this cron API
export const maxDuration = 600; // 5 minutes in seconds

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

    // 3. Define category codes to process
    const specificCategoryCodes = ['win', 'bw', 'tw'];

    // 4. Get specific category IDs
    const specificCategories = await SpecificCategory.find({
      specificCategoryCode: { $in: specificCategoryCodes },
    }).select('_id').lean();

    const specificCategoryIds = specificCategories.map(cat => cat._id);

    // 5. Get products that need updating (batch processing for performance)
    const batchSize = 50; // Process 50 products at a time
    const maxProcessingTime = 4.5 * 60 * 1000; // 4.5 minutes max processing time
    
    let processedInThisCycle = 0;
    let totalUpdated = 0;
    let currentIndex = currentCycle.lastProcessedIndex;

    while (Date.now() - startTime < maxProcessingTime) {
      // Get next batch of products
      const products = await Product.find({
        specificCategory: { $in: specificCategoryIds },
        available: true,
      })
        .populate('specificCategoryVariant')
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

          if (shouldUpdate) {
            // Create/update main product catalogue entry
            const feedData = createFeedData(product);
            
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
            const options = await Option.find({ product: product._id }).lean();
            
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

              if (shouldUpdateOption) {
                const optionFeedData = createFeedDataForOption(product, option);
                
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
 */
function createFeedData(product) {
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

  return {
    id: product._id.toString(),
    title: product.title || product.name,
    description: description.substring(0, 500), // Limit description length
    availability: product.available ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`,
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageUrl,
    brand: 'Maddy Custom',
  };
}

/**
 * Create feed data for a product option
 */
function createFeedDataForOption(product, option) {
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

  return {
    id: `${product._id}-${option._id}`,
    title: optionTitle.substring(0, 150), // Limit title length
    description: description.substring(0, 500), // Limit description length
    availability: product.available ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${product.price} INR`, // Options typically use same price as base product
    link: `${baseUrl}/shop${product.pageSlug}`,
    image_link: imageUrl,
    brand: 'Maddy Custom',
  };
}
