/**
 * Google Product Taxonomy Category Mapping
 * 
 * Maps SpecificCategory names and IDs to Google Product Taxonomy numeric IDs.
 * Reference: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 */

// SpecificCategory ID to Category Name mapping (from database)
export const SPECIFIC_CATEGORY_ID_MAP = {
  '673aea6778c57ec01acae635': 'tw',   // Tank Wraps
  '673aea6778c57ec01acae633': 'bw',   // Bonnet Wraps
  '673aea6778c57ec01acae632': 'win',  // Window Pillar Wraps
  '67af289078259b187eff13b8': 'f',    // Fuel Cap Wraps
  '67d95873451481014c7d0bb2': 'caf',  // Car Air Fresheners
  '68873c6d72ae4d82180671e6': 'rf',   // Roof Wraps
  '689b82cd828fe7e9054ad87d': 'nr',   // Car Neck Rests
  '689b8518828fe7e9054ad87e': 'cc',   // Car Cushions
  '689b8523828fe7e9054ad87f': 'sbc',  // Seatbelt Covers
};

// Google Product Taxonomy numeric IDs
// From: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
export const GOOGLE_TAXONOMY_IDS = {
  // 8202 - Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor > Vehicle Decor > Vehicle Wraps
  VEHICLE_WRAPS: '8202',
  
  // 2789 - Home & Garden > Decor > Home Fragrances > Air Fresheners
  AIR_FRESHENERS: '2789',
  
  // 8233 - Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Interior Fittings
  INTERIOR_FITTINGS: '8233',
  
  // 326120 - Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Interior Fittings > Motor Vehicle Seating > Motor Vehicle Seat Parts & Accessories > Motor Vehicle Seatbelt Parts & Accessories > Motor Vehicle Seatbelt Covers
  SEATBELT_COVERS: '326120',
  
  // 8464 - Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Steering Wheel Covers
  STEERING_COVERS: '8464',
  
  // 5613 - Default fallback: Vehicles & Parts > Vehicle Parts & Accessories
  DEFAULT: '5613',
};

// Category name (shorthand) to Google Taxonomy ID mapping
export const CATEGORY_NAME_TO_GOOGLE_ID = {
  // Wraps - all use 8202
  'tw': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,   // Tank Wraps
  'bw': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,   // Bonnet Wraps
  'win': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,  // Window Pillar Wraps
  'f': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,    // Fuel Cap Wraps
  'rf': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,   // Roof Wraps
  
  // Accessories - specific categories
  'caf': GOOGLE_TAXONOMY_IDS.AIR_FRESHENERS,    // Car Air Fresheners
  'nr': GOOGLE_TAXONOMY_IDS.INTERIOR_FITTINGS,  // Car Neck Rests
  'cc': GOOGLE_TAXONOMY_IDS.INTERIOR_FITTINGS,  // Car Cushions
  'sbc': GOOGLE_TAXONOMY_IDS.SEATBELT_COVERS,   // Seatbelt Covers
  'sc': GOOGLE_TAXONOMY_IDS.STEERING_COVERS,    // Steering Covers (if added later)
};

// Full category name to Google Taxonomy ID mapping
export const FULL_CATEGORY_NAME_TO_GOOGLE_ID = {
  'Tank Wraps': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,
  'Bonnet Wraps': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,
  'Window Pillar Wraps': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,
  'Fuel Cap Wraps': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,
  'Roof Wraps': GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS,
  'Car Air Fresheners': GOOGLE_TAXONOMY_IDS.AIR_FRESHENERS,
  'Car Neck Rests': GOOGLE_TAXONOMY_IDS.INTERIOR_FITTINGS,
  'Car Cushions': GOOGLE_TAXONOMY_IDS.INTERIOR_FITTINGS,
  'Seatbelt Covers': GOOGLE_TAXONOMY_IDS.SEATBELT_COVERS,
  'Steering Covers': GOOGLE_TAXONOMY_IDS.STEERING_COVERS,
};

/**
 * Get Google Product Category ID from SpecificCategory ObjectId
 * @param {string} specificCategoryId - MongoDB ObjectId string of SpecificCategory
 * @returns {string} Google Product Taxonomy numeric ID
 */
export function getGoogleCategoryFromSpecificCategoryId(specificCategoryId) {
  if (!specificCategoryId) return GOOGLE_TAXONOMY_IDS.DEFAULT;
  
  const categoryName = SPECIFIC_CATEGORY_ID_MAP[specificCategoryId.toString()];
  if (!categoryName) return GOOGLE_TAXONOMY_IDS.DEFAULT;
  
  return CATEGORY_NAME_TO_GOOGLE_ID[categoryName] || GOOGLE_TAXONOMY_IDS.DEFAULT;
}

/**
 * Get Google Product Category ID from category short name (e.g., 'tw', 'bw', 'caf')
 * @param {string} categoryShortName - Short category name
 * @returns {string} Google Product Taxonomy numeric ID
 */
export function getGoogleCategoryFromShortName(categoryShortName) {
  if (!categoryShortName) return GOOGLE_TAXONOMY_IDS.DEFAULT;
  return CATEGORY_NAME_TO_GOOGLE_ID[categoryShortName.toLowerCase()] || GOOGLE_TAXONOMY_IDS.DEFAULT;
}

/**
 * Get Google Product Category ID from full category name (e.g., 'Tank Wraps', 'Car Air Fresheners')
 * @param {string} fullCategoryName - Full category name
 * @returns {string} Google Product Taxonomy numeric ID
 */
export function getGoogleCategoryFromFullName(fullCategoryName) {
  if (!fullCategoryName) return GOOGLE_TAXONOMY_IDS.DEFAULT;
  return FULL_CATEGORY_NAME_TO_GOOGLE_ID[fullCategoryName] || GOOGLE_TAXONOMY_IDS.DEFAULT;
}

/**
 * Get Google Product Category ID from product data
 * Tries SpecificCategory first, then falls back to generic category logic
 * @param {Object} product - Product object with specificCategory and category fields
 * @returns {string} Google Product Taxonomy numeric ID
 */
export function getGoogleCategoryFromProduct(product) {
  if (!product) return GOOGLE_TAXONOMY_IDS.DEFAULT;
  
  // Try to get from specificCategory ID first (most accurate)
  if (product.specificCategory) {
    const categoryId = getGoogleCategoryFromSpecificCategoryId(
      product.specificCategory._id || product.specificCategory
    );
    if (categoryId !== GOOGLE_TAXONOMY_IDS.DEFAULT) {
      return categoryId;
    }
  }
  
  // Try to get from specificCategory name
  if (product.specificCategory?.name) {
    const categoryId = getGoogleCategoryFromFullName(product.specificCategory.name);
    if (categoryId !== GOOGLE_TAXONOMY_IDS.DEFAULT) {
      return categoryId;
    }
  }
  
  // Fall back to generic category mapping
  if (product.category === 'Wraps') {
    return GOOGLE_TAXONOMY_IDS.VEHICLE_WRAPS;
  } else if (product.category === 'Accessories') {
    return GOOGLE_TAXONOMY_IDS.INTERIOR_FITTINGS;
  }
  
  return GOOGLE_TAXONOMY_IDS.DEFAULT;
}
