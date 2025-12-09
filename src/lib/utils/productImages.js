/**
 * Product Image Utilities
 * 
 * Builds the complete image array for a product, matching the logic used in ImageGallery component.
 * Used by Meta catalogue feed and Google Merchant sync.
 */

const CDN_URL = 'https://d26w01jhwuuxpo.cloudfront.net';

/**
 * Normalize an image path to a full CDN URL
 * @param {string} img - Image path or URL
 * @returns {string|null} Full CDN URL or null if invalid
 */
function normalizeImageUrl(img) {
  if (!img || typeof img !== 'string' || img.trim().length === 0) {
    return null;
  }
  
  // Already a full URL
  if (img.startsWith('http')) {
    return img;
  }
  
  // Relative path - prepend CDN
  return img.startsWith('/') ? `${CDN_URL}${img}` : `${CDN_URL}/${img}`;
}

/**
 * Extract images from EditorJS blocks (used for ProductInfoTab content)
 * @param {Array} blocks - EditorJS blocks array
 * @returns {string[]} Array of image URLs
 */
export function extractImagesFromBlocks(blocks) {
  const images = [];
  
  if (!Array.isArray(blocks)) {
    return images;
  }
  
  for (const block of blocks) {
    if (block.type === 'image' && block.data?.file?.url) {
      images.push(block.data.file.url);
    }
  }
  
  return images;
}

/**
 * Build complete product images array matching ImageGallery component logic
 * 
 * Priority order:
 * 1. Product images (product.images)
 * 2. Description images (from ProductInfoTab, if category allows)
 * 3. Common gallery images (category.commonGalleryImages)
 * 4. Variant common card images (variant.commonProductCardImages)
 * 5. Category common card images (category.commonProductCardImages)
 * 
 * @param {Object} product - The product object
 * @param {Object} variant - The variant object (optional)
 * @param {Object} category - The category object (optional)
 * @param {string[]} descriptionImages - Pre-extracted description images from ProductInfoTab (optional)
 * @returns {Object} { imageLink: string, additionalImageLinks: string[] }
 */
export function buildProductImageGallery(product, variant = null, category = null, descriptionImages = []) {
  const allImages = [];
  
  // 1. Product images (primary source)
  if (Array.isArray(product?.images)) {
    allImages.push(...product.images);
  }
  
  // 2. Description images (if category allows and images provided)
  if (category?.showDescriptionImagesInGallery && Array.isArray(descriptionImages)) {
    allImages.push(...descriptionImages);
  }
  
  // 3. Common gallery images from category
  if (Array.isArray(category?.commonGalleryImages)) {
    allImages.push(...category.commonGalleryImages);
  }
  
  // 4. Variant common product card images
  if (Array.isArray(variant?.commonProductCardImages)) {
    allImages.push(...variant.commonProductCardImages);
  }
  
  // 5. Category common product card images
  if (Array.isArray(category?.commonProductCardImages)) {
    allImages.push(...category.commonProductCardImages);
  }
  
  // Normalize all URLs and filter out invalid ones
  const normalizedImages = allImages
    .map(normalizeImageUrl)
    .filter(Boolean);
  
  // Remove duplicates while preserving order
  const uniqueImages = [...new Set(normalizedImages)];
  
  // Return primary image and additional images (up to 10 additional for Google/Meta)
  return {
    imageLink: uniqueImages[0] || '',
    additionalImageLinks: uniqueImages.slice(1, 11), // Max 10 additional images
  };
}

/**
 * Build images for a product option
 * Uses option images first, falls back to product gallery
 * 
 * @param {Object} product - The product object
 * @param {Object} option - The option object with images
 * @param {Object} variant - The variant object (optional)
 * @param {Object} category - The category object (optional)
 * @param {string[]} descriptionImages - Pre-extracted description images from ProductInfoTab (optional)
 * @returns {Object} { imageLink: string, additionalImageLinks: string[] }
 */
export function buildOptionImageGallery(product, option, variant = null, category = null, descriptionImages = []) {
  // If option has images, use them as primary
  if (Array.isArray(option?.images) && option.images.length > 0) {
    const optionImages = option.images.map(normalizeImageUrl).filter(Boolean);
    
    // Get product gallery for additional images
    const productGallery = buildProductImageGallery(product, variant, category, descriptionImages);
    
    // Combine: option images first, then product gallery images
    const allImages = [...new Set([...optionImages, productGallery.imageLink, ...productGallery.additionalImageLinks])].filter(Boolean);
    
    return {
      imageLink: allImages[0] || '',
      additionalImageLinks: allImages.slice(1, 11),
    };
  }
  
  // Fall back to product gallery
  return buildProductImageGallery(product, variant, category, descriptionImages);
}
