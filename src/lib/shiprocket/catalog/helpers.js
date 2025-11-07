import mongoose from 'mongoose';

const CLOUD_FRONT_FALLBACK = 'https://d26w01jhwuuxpo.cloudfront.net';

const cloudfrontBase = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  if (!fromEnv || typeof fromEnv !== 'string') return CLOUD_FRONT_FALLBACK;
  return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
})();

// ID utilities for Shiprocket integration
// Use the saved uniqueNumericId field directly
const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return '';
};

export const isValidObjectId = (value) => {
  if (!value || typeof value !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(value);
};

export const isValidNumericId = (value) => {
  // Check if it's a valid number string or number
  const num = typeof value === 'string' ? Number(value) : value;
  return !isNaN(num) && num > 0 && isFinite(num);
};

export const getShiprocketId = (document) => {
  if (!document) return 0;
  
  // Use the saved uniqueNumericId if available
  if (document.uniqueNumericId && Number.isFinite(document.uniqueNumericId)) {
    return document.uniqueNumericId;
  }
  
  // Fallback: generate from ObjectId (should not happen after migration)
  const idString = toObjectIdString(document._id || document);
  if (!idString || !mongoose.Types.ObjectId.isValid(idString)) return 0;
  
  const hexSubstring = idString.slice(-15);
  const numeric = Number.parseInt(hexSubstring, 16);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

export const normalizePagination = (searchParams) => {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '100', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limitCandidate = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100;
  const limit = Math.min(limitCandidate, 250);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const ensureAbsoluteImageUrl = (relativePath) => {
  if (!relativePath || typeof relativePath !== 'string') return '';
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${cloudfrontBase}${normalized}`;
};

const coalesceText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const wrapHtmlParagraph = (value) => {
  if (!value) return '';
  const sanitized = value.replace(/\s+/g, ' ').trim();
  return sanitized ? `<p>${sanitized}</p>` : '';
};

const uniqueArray = (values) => {
  return Array.from(new Set(values.filter(Boolean)));
};

const formatMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '0.00';
  return numeric.toFixed(2);
};

const extractWeightAndDimensions = (variant, packagingBox) => {
  // Get weight from variant's packagingDetails
  const productWeight = variant?.packagingDetails?.productWeight || 0;
  const weightKg = Number.isFinite(productWeight) && productWeight > 0 
    ? Number(productWeight.toFixed(3)) 
    : 0;
  const grams = Math.round(weightKg * 1000);
  
  // Get dimensions from populated PackagingBox
  const dimensions = {
    length: 0,
    breadth: 0,
    height: 0,
  };
  
  if (packagingBox?.dimensions) {
    dimensions.length = Number(packagingBox.dimensions.length) || 0;
    dimensions.breadth = Number(packagingBox.dimensions.breadth) || 0;
    dimensions.height = Number(packagingBox.dimensions.height) || 0;
  }
  
  return { weightKg, grams, dimensions };
};

const resolveImageCandidate = (product, variant) => {
  const productImage = Array.isArray(product?.images) ? product.images.find(Boolean) : null;
  const variantImage = Array.isArray(variant?.commonGalleryImages) 
    ? variant.commonGalleryImages.find(Boolean) 
    : null;
  return productImage || variant?.thumbnail || variantImage || '';
};

export const buildProductPayload = ({
  product,
  options = [], // Array of Option documents
  variant, // SpecificCategoryVariant
  packagingBox, // PackagingBox document
}) => {
  if (!product) return null;
  
  const specCategory = product.specificCategory || {};
  const brand = product.brand || {};
  const inventory = product.inventoryData || {};

  const productId = getShiprocketId(product);

  const title = coalesceText(product.title, product.name) || 'Product';
  
  // Get raw description text
  let rawDescription = coalesceText(
    variant?.productDescription,
    variant?.description,
    specCategory?.description,
    product.title,
    product.name,
  );
  
  // Replace {uniqueName} placeholder with actual product name
  if (rawDescription.includes('{uniqueName}')) {
    const productName = coalesceText(product.name, product.title);
    rawDescription = rawDescription.replace(/\{uniqueName\}/g, productName);
  }
  
  const bodyHtml = wrapHtmlParagraph(rawDescription);

  const vendor = coalesceText(brand.name, 'Maddy Custom');
  const productType = coalesceText(variant?.name, specCategory?.name, product.category, 'General');

  const handleRaw = typeof product.pageSlug === 'string' ? product.pageSlug : '';
  const handleWithoutSlash = handleRaw.startsWith('/') ? handleRaw.slice(1) : handleRaw;
  const handle = handleWithoutSlash ? `shop/${handleWithoutSlash}` : '';

  const tags = Array.isArray(product.mainTags) && product.mainTags.length > 0
    ? product.mainTags.join(', ')
    : '';

  const imageCandidate = resolveImageCandidate(product, variant);
  const imageUrl = ensureAbsoluteImageUrl(imageCandidate);

  // Build variants from Options (if available) or single default variant
  const shiprocketVariants = [];
  
  // Check if category uses on-demand inventory mode
  const isOnDemand = specCategory?.inventoryMode === 'on-demand';
  const onDemandQuantity = 999999;
  
  if (options && options.length > 0) {
    // Product has options - each option becomes a variant
    for (const option of options) {
      const optionInventory = option.inventoryData || {};
      
      // Use 999999 for on-demand or when no inventory ref, otherwise use actual quantity
      let optionQuantity;
      if (isOnDemand || !optionInventory || !optionInventory._id) {
        optionQuantity = onDemandQuantity;
      } else {
        optionQuantity = Number.isFinite(optionInventory.availableQuantity)
          ? Math.max(0, optionInventory.availableQuantity)
          : onDemandQuantity;
      }
      
      const { weightKg, grams } = extractWeightAndDimensions(variant, packagingBox);
      
      // Build option_values from optionDetails Map
      const optionValues = {};
      if (option.optionDetails && option.optionDetails instanceof Map) {
        option.optionDetails.forEach((value, key) => {
          // Capitalize first letter of key
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          optionValues[formattedKey] = value || '';
        });
      } else if (option.optionDetails && typeof option.optionDetails === 'object') {
        Object.entries(option.optionDetails).forEach(([key, value]) => {
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          optionValues[formattedKey] = value || '';
        });
      }
      
      // Fallback if no option values
      if (Object.keys(optionValues).length === 0) {
        optionValues['Option'] = option.sku || 'Default';
      }
      
      const optionImageCandidate = Array.isArray(option.images) && option.images[0]
        ? option.images[0]
        : imageCandidate;
      const optionImageUrl = ensureAbsoluteImageUrl(optionImageCandidate);
      
      const variantTitle = Object.values(optionValues).filter(Boolean).join(' / ') || option.sku || 'Default';
      
      shiprocketVariants.push({
        id: getShiprocketId(option),
        title: variantTitle,
        price: formatMoney(product.price),
        compare_at_price: formatMoney(product.MRP || product.price),
        sku: option.sku || '',
        created_at: option.createdAt 
          ? new Date(option.createdAt).toISOString() 
          : new Date(product.createdAt).toISOString(),
        updated_at: option.updatedAt 
          ? new Date(option.updatedAt).toISOString() 
          : new Date(product.updatedAt).toISOString(),
        quantity: optionQuantity,
        taxable: true,
        option_values: optionValues,
        grams,
        weight: weightKg,
        weight_unit: 'kg',
        image: { src: optionImageUrl || '' },
      });
    }
  } else {
    // No options - create single default variant
    
    // Use 999999 for on-demand or when no inventory ref, otherwise use actual quantity
    let quantity;
    if (isOnDemand || !inventory || !inventory._id) {
      quantity = onDemandQuantity;
    } else {
      quantity = Number.isFinite(inventory.availableQuantity)
        ? Math.max(0, inventory.availableQuantity)
        : onDemandQuantity;
    }
    
    const { weightKg, grams } = extractWeightAndDimensions(variant, packagingBox);
    
    shiprocketVariants.push({
      id: getShiprocketId(product), // Use product ID as variant ID
      title: title,
      price: formatMoney(product.price),
      compare_at_price: formatMoney(product.MRP || product.price),
      sku: product.sku || '',
      created_at: product.createdAt ? new Date(product.createdAt).toISOString() : new Date(0).toISOString(),
      updated_at: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
      quantity,
      taxable: true,
      option_values: { 'Title': 'Default Title' },
      grams,
      weight: weightKg,
      weight_unit: 'kg',
      image: { src: imageUrl || '' },
    });
  }

  // Build options array from the first variant's option_values
  const optionsArray = [];
  if (shiprocketVariants.length > 0) {
    const firstVariant = shiprocketVariants[0];
    Object.keys(firstVariant.option_values).forEach(optionName => {
      const values = [
        ...new Set(
          shiprocketVariants.map(v => v.option_values[optionName]).filter(Boolean)
        )
      ];
      optionsArray.push({
        name: optionName,
        values: values.length > 0 ? values : [''],
      });
    });
  }

  const productPayload = {
    id: productId,
    title,
    body_html: bodyHtml,
    vendor,
    product_type: productType,
    created_at: product.createdAt ? new Date(product.createdAt).toISOString() : new Date(0).toISOString(),
    updated_at: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
    handle,
    status: 'active',
    tags,
    variants: shiprocketVariants,
    options: optionsArray,
    image: { src: imageUrl || '' },
  };

  return productPayload;
};

export const buildCollectionPayload = (variant) => {
  if (!variant) return null;
  
  const collectionId = getShiprocketId(variant);
  const handleRaw = typeof variant.pageSlug === 'string' ? variant.pageSlug : '';
  const handleWithoutSlash = handleRaw.startsWith('/') ? handleRaw.slice(1) : handleRaw;
  const handle = handleWithoutSlash ? `shop/${handleWithoutSlash}` : '';
  
  const bodyHtml = wrapHtmlParagraph(coalesceText(variant.description, variant.productDescription));
  const imageCandidate = variant.commonGalleryImages?.[0] || variant.thumbnail || '';
  const imageUrl = ensureAbsoluteImageUrl(imageCandidate);

  const payload = {
    id: collectionId,
    title: coalesceText(variant.name, variant.title, 'Collection'),
    handle,
    body_html: bodyHtml,
    created_at: variant.createdAt ? new Date(variant.createdAt).toISOString() : new Date(0).toISOString(),
    updated_at: variant.updatedAt ? new Date(variant.updatedAt).toISOString() : new Date().toISOString(),
    image: { src: imageUrl || '' },
  };

  return payload;
};
