/* ---------------------------------------------------------------------- */
/* Cache Warmer for Top Bought Products                                   */
/* Run this to pre-populate cache for instant responses                   */
/* ---------------------------------------------------------------------- */

import connectToDatabase from '@/lib/middleware/connectToDb.js';
import SpecificCategory from '@/models/SpecificCategory.js';

// Common category combinations to pre-cache
const CACHE_TARGETS = [
  { subCategories: ['Car Wraps', 'Car Care'] },
  { subCategories: ['Car Wraps'] },
  { subCategories: ['Car Care'] },
  { subCategories: ['Bike Wraps'] },
  { singleCategoryCode: 'car-exterior-wraps' },
  { singleCategoryCode: 'car-interior-wraps' },
  { singleCategoryCode: 'bike-wraps' },
  { singleVariantCode: 'full-car-wrap' },
  { singleVariantCode: 'car-roof-wrap' },
];

async function warmCache() {
  try {
    console.log('🔥 Starting cache warming...');
    await connectToDatabase();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    for (const target of CACHE_TARGETS) {
      try {
        const params = new URLSearchParams({ skip: '0' });
        
        if (target.subCategories) {
          params.set('subCategories', target.subCategories.join(','));
        }
        if (target.singleCategoryCode) {
          params.set('singleCategoryCode', target.singleCategoryCode);
        }
        if (target.singleVariantCode) {
          params.set('singleVariantCode', target.singleVariantCode);
        }

        const url = `${baseUrl}/api/showcase/products/top-bought?${params}`;
        console.log(`  📡 Warming: ${params.toString()}`);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ Cached ${data.products?.length || 0} products`);
        } else {
          console.log(`  ❌ Failed: ${response.status}`);
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`  ❌ Error warming cache:`, error.message);
      }
    }

    console.log('🚀 Cache warming complete!');
    
  } catch (error) {
    console.error('Cache warming failed:', error);
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  warmCache();
}

export { warmCache };
