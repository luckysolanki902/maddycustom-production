/**
 * Product Title & Description Builder for Shopping Feeds
 * 
 * Generates SEO-optimized titles for Google Merchant Center and Meta Commerce.
 * 
 * Best practices for Shopping titles:
 * - Include brand name
 * - Include product type/category keywords
 * - Include key attributes (material, size, use case)
 * - Keep under 150 characters (Google truncates at ~70 for display)
 * - Front-load important keywords
 */

// Category-specific keyword templates for SEO
const CATEGORY_KEYWORDS = {
  // Window Pillar Wraps
  'Window Pillar Wraps': {
    keywords: ['Car Pillar Wrap', 'B Pillar Sticker', 'Window Pillar Decal', 'Car Door Pillar Wrap'],
    suffix: 'Premium Vinyl Graphics for Cars',
    attributes: ['Easy to Apply', 'UV Resistant', 'Bubble-Free'],
  },
  
  // Tank Wraps (Bike)
  'Tank Wraps': {
    keywords: ['Bike Tank Wrap', 'Motorcycle Tank Sticker', 'Fuel Tank Decal', 'Bike Tank Graphics'],
    suffix: 'Premium Vinyl Wrap for Bikes',
    attributes: ['Scratch Resistant', 'Waterproof', 'Easy Install'],
  },
  
  // Bonnet Wraps
  'Bonnet Wraps': {
    keywords: ['Car Hood Wrap', 'Bonnet Sticker', 'Hood Decal', 'Car Bonnet Graphics'],
    suffix: 'Premium Car Hood Vinyl Wrap',
    attributes: ['Heat Resistant', 'UV Protected', 'Custom Fit'],
  },
  
  // Fuel Cap Wraps
  'Fuel Cap Wraps': {
    keywords: ['Fuel Cap Sticker', 'Petrol Cap Decal', 'Tank Cap Wrap'],
    suffix: 'Premium Fuel Cap Decal',
    attributes: ['Waterproof', 'Durable'],
  },
  
  // Roof Wraps
  'Roof Wraps': {
    keywords: ['Car Roof Wrap', 'Roof Vinyl Sticker', 'Car Top Wrap'],
    suffix: 'Premium Car Roof Vinyl Wrap',
    attributes: ['Weather Resistant', 'Easy Apply'],
  },
  
  // Car Air Fresheners
  'Car Air Fresheners': {
    keywords: ['Car Air Freshener', 'Hanging Car Freshener', 'Auto Fragrance'],
    suffix: 'Long Lasting Car Perfume',
    attributes: ['Natural Fragrance', 'Lasts 30+ Days'],
  },
  
  // Seatbelt Covers
  'Seatbelt Covers': {
    keywords: ['Seatbelt Cover', 'Seat Belt Pad', 'Seatbelt Cushion', 'Car Safety Belt Cover'],
    suffix: 'Soft Comfortable Shoulder Pad',
    attributes: ['Soft Padding', 'Universal Fit', 'Easy Install'],
  },
  
  // Car Cushions
  'Car Cushions': {
    keywords: ['Car Seat Cushion', 'Auto Seat Pad', 'Car Back Support'],
    suffix: 'Ergonomic Car Seat Cushion',
    attributes: ['Memory Foam', 'Breathable', 'Universal Fit'],
  },
  
  // Car Neck Rests
  'Car Neck Rests': {
    keywords: ['Car Neck Pillow', 'Headrest Cushion', 'Car Neck Support'],
    suffix: 'Comfortable Car Headrest Pillow',
    attributes: ['Memory Foam', 'Ergonomic Design'],
  },
  
  // Steering Covers
  'Steering Covers': {
    keywords: ['Steering Wheel Cover', 'Car Steering Cover', 'Steering Grip Cover'],
    suffix: 'Anti-Slip Steering Wheel Cover',
    attributes: ['Non-Slip Grip', 'Universal Fit', 'Breathable'],
  },
};

// Default keywords for unmatched categories
const DEFAULT_KEYWORDS = {
  'Wraps': {
    keywords: ['Car Wrap', 'Vehicle Vinyl Wrap', 'Auto Decal'],
    suffix: 'Premium Vinyl Wrap',
    attributes: ['Easy Apply', 'Durable'],
  },
  'Accessories': {
    keywords: ['Car Accessory', 'Auto Accessory', 'Vehicle Accessory'],
    suffix: 'Premium Car Accessory',
    attributes: ['High Quality', 'Durable'],
  },
};

/**
 * Build an SEO-optimized title for Google Shopping / Meta Commerce
 * 
 * Format: "[Product Name] - [Category Keyword] | [Key Attribute] | Maddy Custom"
 * Example: "Eagle Window Pillar Wrap - Car Pillar Sticker | UV Resistant | Maddy Custom"
 * 
 * @param {Object} product - Product object with name, title, category, subCategory
 * @param {Object} variant - Variant object (specificCategoryVariant)
 * @param {Object} category - Category object (specificCategory) with name field
 * @returns {string} SEO-optimized title (max 150 chars)
 */
export function buildShoppingTitle(product, variant = null, category = null) {
  const productName = product.title || product.name || 'Product';
  const categoryName = category?.name || product.subCategory || '';
  const genericCategory = product.category || 'Accessories';
  
  // Get category-specific keywords
  let categoryData = CATEGORY_KEYWORDS[categoryName];
  if (!categoryData) {
    categoryData = DEFAULT_KEYWORDS[genericCategory] || DEFAULT_KEYWORDS['Accessories'];
  }
  
  // Pick the first keyword as the main SEO term
  const mainKeyword = categoryData.keywords[0];
  
  // Pick one attribute
  const attribute = categoryData.attributes[0];
  
  // Build title parts
  const parts = [
    productName,
    mainKeyword,
    attribute,
    'Maddy Custom'
  ];
  
  // Join with separators and ensure under 150 chars
  let title = `${productName} - ${mainKeyword} | ${attribute} | Maddy Custom`;
  
  // If too long, use shorter format
  if (title.length > 150) {
    title = `${productName} - ${mainKeyword} | Maddy Custom`;
  }
  
  // If still too long, just use product name with brand
  if (title.length > 150) {
    title = `${productName} | Maddy Custom`.substring(0, 150);
  }
  
  return title;
}

/**
 * Build an SEO-optimized description for Google Shopping / Meta Commerce
 * 
 * @param {Object} product - Product object
 * @param {Object} variant - Variant object with productDescription
 * @param {Object} category - Category object with name
 * @returns {string} SEO-optimized description (max 5000 chars for Google, 500 for display)
 */
export function buildShoppingDescription(product, variant = null, category = null) {
  const productName = product.title || product.name || 'Product';
  const categoryName = category?.name || product.subCategory || '';
  const genericCategory = product.category || 'Accessories';
  
  // Get category-specific data
  let categoryData = CATEGORY_KEYWORDS[categoryName];
  if (!categoryData) {
    categoryData = DEFAULT_KEYWORDS[genericCategory] || DEFAULT_KEYWORDS['Accessories'];
  }
  
  // Start with variant description if available
  let baseDescription = '';
  if (variant?.productDescription) {
    baseDescription = variant.productDescription
      .replace(/{uniqueName}/g, product.name || '')
      .replace(/{fullBikename}/g, variant.name || '');
  } else {
    baseDescription = `${productName} from Maddy Custom.`;
  }
  
  // Add SEO keywords
  const keywordsText = categoryData.keywords.slice(0, 3).join(', ');
  const attributesText = categoryData.attributes.join(', ');
  
  // Build full description
  const description = `${baseDescription} ${categoryData.suffix}. Features: ${attributesText}. Shop ${keywordsText} at Maddy Custom. Free delivery available.`;
  
  return description.substring(0, 5000);
}

/**
 * Build title for a product option (variant)
 * 
 * @param {Object} product - Product object
 * @param {Object} option - Option object with optionDetails
 * @param {Object} variant - Variant object
 * @param {Object} category - Category object
 * @returns {string} SEO-optimized title for option
 */
export function buildOptionShoppingTitle(product, option, variant = null, category = null) {
  // Get base title
  let baseTitle = buildShoppingTitle(product, variant, category);
  
  // Add option details if present
  if (option?.optionDetails && typeof option.optionDetails === 'object') {
    const optionValues = Object.values(option.optionDetails);
    if (optionValues.length > 0) {
      const optionStr = optionValues.join(' ');
      // Insert option value after product name
      const productName = product.title || product.name || 'Product';
      baseTitle = baseTitle.replace(productName, `${productName} - ${optionStr}`);
    }
  }
  
  return baseTitle.substring(0, 150);
}

const shoppingTitlesUtils = {
  buildShoppingTitle,
  buildShoppingDescription,
  buildOptionShoppingTitle,
  CATEGORY_KEYWORDS,
};

export default shoppingTitlesUtils;
