// Product search utility for assistant function-calling
// Applies availability, inventory, price, and keyword filters with pagination

import connectToDb from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Inventory from '@/models/Inventory';
import DesignGroup from '@/models/DesignGroup';
import Order from '@/models/Order';

const DEFAULT_LIMIT = 6;
// Cap explicit user requests at 10 as per requirement
const MAX_LIMIT = 10;

function clampLimit(limit) {
  if (!limit || isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, parseInt(limit, 10)), MAX_LIMIT);
}

function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [val].filter(Boolean);
}

function buildImageUrl(relative) {
  if (!relative) return null;
  const base = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';
  if (relative.startsWith('http')) return relative;
  if (relative.startsWith('/')) return `${base}${relative}`;
  return `${base}/${relative}`;
}

// Basic keyword extraction (split, lowercase, dedupe)
const STOPWORDS = new Set([
  'show','some','find','suggest','recommend','get','need','want','see','me','for','a','an','the','please','pls','with','and','or','to','of','under','below','less','than','over','above','more','rs','price','cost','in','on','at','any',
  // Popularity & generic product words we don't want as filters
  'popular','best','top','bestselling','selling','trending','hot',
  'product','products','item','items',
  // Style noise
  'theme','themed','inspired','style','styled','type'
]);
// Structural tokens - product category types that shouldn't be keywords when categoryTitle is set
const STRUCTURAL_STOPWORDS = new Set(['wrap','wraps','pillar','pillars','tank','tanks','roof','bonnet','freshener','fresheners','cushion','cushions','keychain','keychains','sticker','stickers','decal','decals','cover','covers','rest','rests']);
// Words we consider too generic in automotive context (optionally removable)
const GENERIC_DOMAIN = new Set([]);

function extractKeywords(q, skipStructural = false) {
  if (!q) return [];
  // Normalize: remove hyphens, common plurals
  const normalized = q
    .toLowerCase()
    .replace(/-/g, ' ')  // split hyphenated words
    .replace(/\bwraps\b/g, 'wrap')
    .replace(/\bpillars\b/g, 'pillar')
    .replace(/\bcushions\b/g, 'cushion');
  const raw = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const filtered = raw.filter(w => {
    if (w.length <= 1) return false;
    if (STOPWORDS.has(w)) return false;
    if (GENERIC_DOMAIN.has(w)) return false;
    // When categoryTitle is set, skip structural words since category handles them
    if (skipStructural && STRUCTURAL_STOPWORDS.has(w)) return false;
    return true; // keep color words like 'red', 'blue', theme words like 'anime'
  });
  return [...new Set(filtered)];
}

// Parse simple numeric hints from free-form text (price, limit, sort)
function parseQueryHints(q) {
  if (!q || typeof q !== 'string') return {};
  const text = q.toLowerCase();

  // Helper to parse amounts like "1k", "1,200", "₹999"
  const parseAmount = (s) => {
    if (!s) return undefined;
    let t = s.replace(/[,₹\s]/g, '');
    const kMatch = /^([0-9]+(?:\.[0-9]+)?)k$/i.exec(t);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
    const n = Number(t);
    return isNaN(n) ? undefined : n;
  };

  let maxPrice, minPrice, limit, sortBy;

  // ranges: between X and Y
  const between = /between\s+([₹]?[0-9][0-9,\.k]*)\s+(?:and|to)\s+([₹]?[0-9][0-9,\.k]*)/.exec(text);
  if (between) {
    const a = parseAmount(between[1]);
    const b = parseAmount(between[2]);
    if (a !== undefined && b !== undefined) {
      minPrice = Math.min(a, b);
      maxPrice = Math.max(a, b);
    }
  }

  // under/less than/below X
  const under = /(under|less than|below)\s+([₹]?[0-9][0-9,\.k]*)/.exec(text);
  if (under) {
    const n = parseAmount(under[2]);
    if (n !== undefined) maxPrice = n;
  }

  // over/more than/above X
  const over = /(over|more than|above)\s+([₹]?[0-9][0-9,\.k]*)/.exec(text);
  if (over) {
    const n = parseAmount(over[2]);
    if (n !== undefined) minPrice = n;
  }

  // exact price mention like "under rs 999" is handled above; also allow lone number with rs/₹ context
  if (maxPrice === undefined && /(?:rs|₹)\s*[0-9]/.test(text)) {
    const m = /(?:rs|₹)\s*([0-9][0-9,\.k]*)/.exec(text);
    const n = parseAmount(m?.[1]);
    if (n !== undefined) maxPrice = n; // assume budget cap if phrased casually with currency
  }

  // limit: "show 1", "show 10", "10 results"
  const lim = /(?:show|list|give|display)\s+([0-9]{1,2})\b|\b([0-9]{1,2})\s+(?:results|items|products)\b/.exec(text);
  const limVal = lim ? Number(lim[1] || lim[2]) : undefined;
  if (!isNaN(limVal)) {
    limit = Math.min(MAX_LIMIT, Math.max(1, limVal));
  }

  // sort: popularity / orders / price
  if (/(most ordered|best(?:-|\s)?selling|popular|top (?:sellers|selling))/.test(text)) sortBy = 'orders';
  if (/(low(?:est)? to high|cheapest|price asc|sort by price asc)/.test(text)) sortBy = 'price_asc';
  if (/(high(?:est)? to low|expensive|price desc|sort by price desc)/.test(text)) sortBy = 'price_desc';

  return { maxPrice, minPrice, limit, sortBy };
}

export async function searchProducts({
  query,
  maxPrice,
  minPrice,
  categoryTitle,
  keywords,
  classificationTags, // NEW: array of tags like ['car-interiors', 'car-exteriors']
  excludeTags, // NEW: array of tags to EXCLUDE like ['bike-personalisation', 'bike-accessories']
  page = 1,
  limit,
  sortBy,
  pageContext,
  diversifyCategories,
  selectBest, // NEW: if set, return only top N products after scoring
}) {
  await connectToDb();
  
  console.log('\n--- productSearch called ---');
  console.log('Input params:', { query, categoryTitle, keywords, classificationTags, excludeTags, maxPrice, minPrice, page, limit, diversifyCategories });
  
  // If limit isn't explicitly provided, try to derive from query text
  const hints = parseQueryHints(query);
  const appliedLimit = limit ?? hints.limit;
  const clampedLimit = clampLimit(appliedLimit);
  const skip = (Math.max(1, page) - 1) * clampedLimit;

  // IMPORTANT: If categoryTitle is provided by planner, extract keywords but skip structural tokens
  // (categoryTitle handles the product type, we want theme/color keywords)
  const kwFromQuery = extractKeywords(query, !!categoryTitle);
  const explicitKeywords = normalizeArray(keywords).map(k => k.toLowerCase()).filter(k => !STOPWORDS.has(k));
  let allKeywords = [...new Set([...kwFromQuery, ...explicitKeywords])];
  // Cap to first 3 to avoid over-constraining AND clauses
  if (allKeywords.length > 3) allKeywords = allKeywords.slice(0,3);

  console.log('Keywords extracted:', { kwFromQuery, explicitKeywords, allKeywords, categoryTitle });

  // Handle classificationTags from planner (e.g., ["car-interiors", "car-exteriors"])
  const explicitClassificationTags = normalizeArray(classificationTags).map(t => t.toLowerCase());
  
  // Handle excludeTags from planner (e.g., ["bike-personalisation", "bike-accessories"])
  const explicitExcludeTags = normalizeArray(excludeTags).map(t => t.toLowerCase());
  
  // Derive domain exclusion from excludeTags (if planner says exclude bike tags, we want to exclude bike products)
  const excludeBike = explicitExcludeTags.some(t => t.includes('bike'));
  const excludeCar = explicitExcludeTags.some(t => t.includes('car'));
  
  // Domain intent detection: consider raw text AND explicit keywords AND classificationTags
  // Note: extractKeywords removes generic tokens like 'car'/'bike', so rely on explicitKeywords too
  const rawText = `${query || ''} ${categoryTitle || ''}`.toLowerCase();
  const wantsBike = !excludeBike && (/\bbike(s)?\b/.test(rawText) || explicitKeywords.includes('bike') || explicitClassificationTags.some(t => t.includes('bike')));
  const wantsCar = !excludeCar && (/\bcar(s)?\b/.test(rawText) || explicitKeywords.includes('car') || explicitClassificationTags.some(t => t.includes('car')));
  const wantsInterior = /\binterior(s)?\b/.test(rawText) || explicitKeywords.includes('interior') || explicitClassificationTags.includes('car-interiors');
  const wantsExterior = /\bexterior(s)?\b/.test(rawText) || explicitKeywords.includes('exterior') || explicitClassificationTags.includes('car-exteriors');

  console.log('Domain detection:', { wantsCar, wantsBike, excludeCar, excludeBike, wantsInterior, wantsExterior });

  // Identify structural (category-like) tokens that we want to enforce strictly
  // Only use these when planner didn't provide categoryTitle
  const STRUCTURAL_TOKENS = new Set(['wrap','wraps','pillar','tank','roof','bonnet','fragrance','perfume','scent','keychain','sticker','decal','cushion','cushions']);
  const DOMAIN_TOKENS = new Set(['car','bike','interior','exterior']);
  const structural = categoryTitle ? [] : allKeywords.filter(w => STRUCTURAL_TOKENS.has(w));
  const theme = allKeywords.filter(w => !STRUCTURAL_TOKENS.has(w));
  // When diversifying and no explicit category, avoid forcing domain words like 'car'/'bike' as required; prefer actual theme (e.g., colors)
  const themeNoDomain = (diversifyCategories && !categoryTitle)
    ? theme.filter(w => !DOMAIN_TOKENS.has(w))
    : theme;

  // Build effectiveRequired based on what planner provided
  // If categoryTitle is set, let categoryTitle filter handle it - don't add keyword requirements
  let effectiveRequired = [];
  if (!categoryTitle) {
    if (themeNoDomain.length) {
      // pick first theme keyword (non-domain when diversifying)
      const preferredTheme = themeNoDomain[0];
      // use first structural token if present (no hardcoded preference)
      const preferredStructural = structural.length ? structural[0] : null;
      effectiveRequired = [preferredTheme, preferredStructural].filter(Boolean);
    } else if (!diversifyCategories && structural.length) {
      // Only use structural as required when not diversifying; during diversify we keep structural optional to widen category pool
      effectiveRequired = structural.slice(0, 2);
    } else if (!diversifyCategories && allKeywords.length) {
      effectiveRequired = [allKeywords[0]];
    }
  }
  const optionalWords = allKeywords.filter(w => !effectiveRequired.includes(w));

  // Apply parsed price hints only if explicit values not given
  const priceFilter = {};
  const effMax = (typeof maxPrice === 'number') ? maxPrice : hints.maxPrice;
  const effMin = (typeof minPrice === 'number') ? minPrice : hints.minPrice;
  if (typeof effMax === 'number') priceFilter.$lte = effMax;
  if (typeof effMin === 'number') priceFilter.$gte = effMin;

  const andClauses = [{ available: { $ne: false } }];
  if (Object.keys(priceFilter).length) andClauses.push({ price: priceFilter });

  // DesignGroup pre-match per required keyword for accurate AND logic
  const dgIdsPerWord = {};
  if (effectiveRequired.length) {
    for (const w of effectiveRequired) {
      const reg = new RegExp(w, 'i');
      const dgDocs = await DesignGroup.find({
        $or: [
          { name: reg },
          { tags: reg },
          { searchKeywords: reg },
        ],
        isActive: { $ne: false },
      }).select('_id').lean();
      dgIdsPerWord[w] = dgDocs.map(d => d._id);
    }
  }

  // Title / searchKeywords / mainTags / slug / design group filtering (AND over allKeywords)
  if (effectiveRequired.length) {
    andClauses.push({
      $and: effectiveRequired.map(word => ({
        $or: [
          { title: { $regex: word, $options: 'i' } },
          // Array fields: use direct regex; MongoDB matches array elements with regex
          { searchKeywords: new RegExp(word, 'i') },
          { mainTags: new RegExp(word, 'i') },
          { pageSlug: { $regex: word, $options: 'i' } },
          ...(Array.isArray(dgIdsPerWord[word]) && dgIdsPerWord[word].length ? [{ designGroupId: { $in: dgIdsPerWord[word] } }] : []),
        ]
      }))
    });
  } else if (theme.length) {
    // If we only have theme tokens (e.g., color like 'red'), still build a broad OR to search products by that
    const ors = [];
    const themeForFilters = themeNoDomain.length ? themeNoDomain : theme; // prefer non-domain theme tokens for filtering
    themeForFilters.slice(0, 2).forEach(word => {
      const reg = new RegExp(word, 'i');
      ors.push(
        { title: reg },
        { searchKeywords: reg },
        { mainTags: reg },
        { pageSlug: reg }
      );
    });
    if (ors.length) andClauses.push({ $or: ors });
  }

  // NEW: Filter by explicit classificationTags from planner (e.g., ["car-interiors", "car-exteriors"])
  let classificationTagMatchedCatIds = [];
  if (explicitClassificationTags.length) {
    const tagRegexes = explicitClassificationTags.map(t => new RegExp(t.replace(/-/g, '[-\\s]?'), 'i'));
    const tagMatchedCats = await SpecificCategory.find({
      classificationTags: { $in: tagRegexes },
      available: { $ne: false }
    }).select('_id classificationTags').lean();
    classificationTagMatchedCatIds = tagMatchedCats.map(c => c._id);
    if (classificationTagMatchedCatIds.length) {
      andClauses.push({ specificCategory: { $in: classificationTagMatchedCatIds } });
    }
  }

  // Category context assistance: if categoryTitle provided use that to filter/bias result.
  let categoryTitleMatchedIds = [];
  if (categoryTitle) {
    // We'll pull matching specific categories first (title/name/subCategory/category/classificationTags based)
    const tokens = String(categoryTitle).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const orConds = [
      { name: { $regex: categoryTitle, $options: 'i' } },
      { title: { $regex: categoryTitle, $options: 'i' } },
      { subCategory: { $regex: categoryTitle, $options: 'i' } },
      { category: { $regex: categoryTitle, $options: 'i' } },
    ];
    if (tokens.length) {
      orConds.push({ classificationTags: { $in: tokens.map(t => new RegExp(t, 'i')) } });
    }
    const catDocs = await SpecificCategory.find({
      $or: orConds,
      available: { $ne: false }
    }).select('_id name title subCategory classificationTags').lean();
    categoryTitleMatchedIds = catDocs.map(c => c._id);
    
    console.log('categoryTitle filter:', {
      categoryTitle,
      tokens,
      matchedCategories: catDocs.map(c => ({ name: c.name, title: c.title, subCategory: c.subCategory })),
      matchedCount: categoryTitleMatchedIds.length
    });
    
    if (categoryTitleMatchedIds.length) {
      andClauses.push({ specificCategory: { $in: categoryTitleMatchedIds } });
    }
    // If category seems like a variantable structure (pillar/tank), prefer categories that include those tokens in classificationTags
    const ct = String(categoryTitle).toLowerCase();
    if (/pillar|tank|roof|bonnet/.test(ct) && catDocs.length) {
      const tightened = catDocs.filter(c => (c.classificationTags||[]).some(t => /pillar|tank|roof|bonnet/i.test(String(t))));
      if (tightened.length) {
        const ids = tightened.map(c => c._id);
        andClauses.push({ specificCategory: { $in: ids } });
      }
    }
  }

  // Domain filter: if user clearly asked for bike vs car and not both, OR if planner explicitly excludes one domain
  if ((wantsBike && !wantsCar) || excludeCar) {
    // Include bike signals and exclude car signals
    if (wantsBike) {
      andClauses.push({ $or: [
        { subCategory: { $regex: /bike/i } },
        { vehicles: { $regex: /bike/i } },
        { mainTags: { $regex: /bike/i } },
        { searchKeywords: { $regex: /bike/i } },
        { title: { $regex: /bike/i } },
        { pageSlug: { $regex: /bike/i } },
      ]});
    }
    andClauses.push({ $nor: [
      { subCategory: { $regex: /car/i } },
      { vehicles: { $regex: /car/i } },
      { mainTags: { $regex: /car/i } },
      { searchKeywords: { $regex: /car/i } },
      { title: { $regex: /car/i } },
      { pageSlug: { $regex: /car/i } },
    ]});
  } else if ((wantsCar && !wantsBike) || excludeBike) {
    // Include car signals and exclude bike signals
    if (wantsCar) {
      andClauses.push({ $or: [
        { subCategory: { $regex: /car/i } },
        { vehicles: { $regex: /car/i } },
        { mainTags: { $regex: /car/i } },
        { searchKeywords: { $regex: /car/i } },
        { title: { $regex: /car/i } },
        { pageSlug: { $regex: /car/i } },
      ]});
    }
    andClauses.push({ $nor: [
      { subCategory: { $regex: /bike/i } },
      { vehicles: { $regex: /bike/i } },
      { mainTags: { $regex: /bike/i } },
      { searchKeywords: { $regex: /bike/i } },
      { title: { $regex: /bike/i } },
      { pageSlug: { $regex: /bike/i } },
    ]});
  }

  // NEW: Apply excludeTags to filter out categories with those tags
  if (explicitExcludeTags.length) {
    const excludeTagRegexes = explicitExcludeTags.map(t => new RegExp(t.replace(/-/g, '[-\\s]?'), 'i'));
    const excludedCats = await SpecificCategory.find({
      classificationTags: { $in: excludeTagRegexes },
      available: { $ne: false }
    }).select('_id').lean();
    const excludedCatIds = excludedCats.map(c => c._id);
    if (excludedCatIds.length) {
      andClauses.push({ specificCategory: { $nin: excludedCatIds } });
    }
  }

  // Category classificationTags discovery (broad, influences scoring not filtering)
  let classificationTagMatchedCats = [];
  if (allKeywords.length || wantsBike || wantsCar || wantsInterior || wantsExterior) {
    const tagTerms = [...allKeywords];
    if (wantsBike) tagTerms.push('bike');
    if (wantsCar) tagTerms.push('car');
    if (wantsInterior) tagTerms.push('interior');
    if (wantsExterior) tagTerms.push('exterior');
    classificationTagMatchedCats = await SpecificCategory.find({
      classificationTags: { $in: tagTerms.map(w => new RegExp(w, 'i')) },
      available: { $ne: false }
    }).select('_id classificationTags name title').lean();
  }
  const classificationTagMatchedCatIdSet = new Set(classificationTagMatchedCats.map(c => c._id.toString()));

  // Domain-based category exclusions: if the user explicitly wants car (and not bike), or if excludeBike is set, exclude bike categories
  if ((wantsCar && !wantsBike) || excludeBike) {
    const bikeCats = await SpecificCategory.find({ classificationTags: { $in: [/bike/i] }, available: { $ne: false } }).select('_id').lean();
    const bikeCatIds = bikeCats.map(c => c._id);
    if (bikeCatIds.length) {
      andClauses.push({ $or: [ { specificCategory: { $nin: bikeCatIds } }, { specificCategory: { $exists: false } } ] });
    }
  } else if ((wantsBike && !wantsCar) || excludeCar) {
    const carCats = await SpecificCategory.find({ classificationTags: { $in: [/car/i] }, available: { $ne: false } }).select('_id').lean();
    const carCatIds = carCats.map(c => c._id);
    if (carCatIds.length) {
      andClauses.push({ $or: [ { specificCategory: { $nin: carCatIds } }, { specificCategory: { $exists: false } } ] });
    }
  }

  const queryMatch = andClauses.length ? { $and: andClauses } : {};

  console.log('Query clauses count:', andClauses.length);
  console.log('Effective filters:', { effectiveRequired, structural, theme });

  // Base product find (limit + extra for post-filter)
  // Over-fetch more aggressively when diversifying to ensure we have enough categories to sample from
  const overFetchFactor = (diversifyCategories && !categoryTitle) ? 8 : 2;
  const raw = await Product.find(queryMatch)
    .select('title price MRP images pageSlug specificCategory specificCategoryVariant productSource inventoryData searchKeywords mainTags available options designGroupId')
    .lean()
    .skip(skip)
    .limit(clampedLimit * overFetchFactor); // over-fetch to allow post filtering and diversification

  console.log('Raw products found:', raw.length, 'titles:', raw.slice(0, 5).map(p => p.title));
  console.log('--- productSearch end ---\n');

  const catIds = [...new Set(raw.filter(p => p.specificCategory).map(p => p.specificCategory))];
  const varIds = [...new Set(raw.filter(p => p.specificCategoryVariant).map(p => p.specificCategoryVariant))];

  const [catMapDocs, varMapDocs] = await Promise.all([
    catIds.length ? SpecificCategory.find({ _id: { $in: catIds } }).select('_id available name title classificationTags inventoryMode').lean() : [],
    varIds.length ? SpecificCategoryVariant.find({ _id: { $in: varIds } }).select('_id available name title').lean() : []
  ]);
  const catAvail = Object.fromEntries(catMapDocs.map(c => [c._id.toString(), c.available !== false]));
  const varAvail = Object.fromEntries(varMapDocs.map(v => [v._id.toString(), v.available !== false]));
  const catClassificationTagsMap = Object.fromEntries(catMapDocs.map(c => [c._id.toString(), (c.classificationTags || []).map(t => (t||'').toLowerCase())]));
  const catInventoryMode = Object.fromEntries(catMapDocs.map(c => [c._id.toString(), c.inventoryMode || 'on-demand']));

  // Inventory check for inventory products or option-level inventory
  const inventoryIds = [];
  raw.forEach(p => {
    if (p.productSource === 'inventory' && p.inventoryData) inventoryIds.push(p.inventoryData);
    if (Array.isArray(p.options)) {
      p.options.forEach(o => { if (o.inventoryData) inventoryIds.push(o.inventoryData); });
    }
  });
  const invDocs = inventoryIds.length ? await Inventory.find({ _id: { $in: inventoryIds } }).select('_id availableQuantity').lean() : [];
  const invMap = Object.fromEntries(invDocs.map(d => [d._id.toString(), d.availableQuantity]));

  const filtered = raw.filter(p => {
    // Safety: product must not be explicitly unavailable
    if (p.available === false) return false;
    // Category & variant availability
    if (p.specificCategory && catAvail[p.specificCategory.toString()] === false) return false;
    if (p.specificCategoryVariant && varAvail[p.specificCategoryVariant.toString()] === false) return false;

    // Inventory gating based on SpecificCategory.inventoryMode
    const scId = p.specificCategory?.toString();
    const requiresInventory = scId ? (catInventoryMode[scId] === 'inventory') : false;
    if (requiresInventory) {
      let inStock = false;
      if (p.inventoryData && invMap[p.inventoryData.toString()] > 0) inStock = true;
      if (!inStock && Array.isArray(p.options)) {
        inStock = p.options.some(o => o.inventoryData && invMap[o.inventoryData.toString()] > 0);
      }
      if (!inStock) return false;
    }
    return true;
  });

  // Relaxed fallback: if inventory gating filtered everything but we have raw candidates,
  // try a pass without inventory quantity checks (some categories are made-to-order and may not use inventory records)
  let effectiveList = filtered;
  let usedRelaxedInventory = false;
  if (effectiveList.length === 0 && raw.length > 0) {
    const relaxed = raw.filter(p => {
      if (p.specificCategory && catAvail[p.specificCategory.toString()] === false) return false;
      if (p.specificCategoryVariant && varAvail[p.specificCategoryVariant.toString()] === false) return false;
      return true; // ignore inventory counters in relaxed mode
    });
    if (relaxed.length) {
      usedRelaxedInventory = true;
      effectiveList = relaxed;
    }
  }

  // Popularity counts (only when requested) – compute for candidate set
  let ordersCountMap = {};
  const requestedSort = sortBy || hints.sortBy;
  if (requestedSort === 'orders' && raw.length) {
    const ids = raw.map(p => p._id);
    const agg = await Order.aggregate([
      { $match: { 'items.product': { $in: ids } } },
      { $unwind: '$items' },
      { $match: { 'items.product': { $in: ids } } },
      { $group: { _id: '$items.product', count: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
    ]);
    ordersCountMap = Object.fromEntries(agg.map(a => [a._id.toString(), a.count]));
  }

  // Scoring
  function scoreProduct(p) {
    let score = 0;
    const lowerTitle = (p.title || '').toLowerCase();
    // Optional words influence ranking more than filtering
    const allForScoring = [...effectiveRequired, ...optionalWords];
    allForScoring.forEach(w => {
  if (lowerTitle.includes(w)) score += 3;
  if ((p.searchKeywords||[]).some(sk => (sk||'').toLowerCase().includes(w))) score += 2.25;
  if ((p.mainTags||[]).some(tag => (tag||'').toLowerCase().includes(w))) score += 2.1; // slightly higher to respect theme tags like 'anime'
      if ((p.pageSlug||'').toLowerCase().includes(w)) score += 1.5;
    });
    // Category classificationTags relevance boost
    if (p.specificCategory) {
      const catId = p.specificCategory.toString();
      if (classificationTagMatchedCatIdSet.has(catId)) {
        score += 2; // base boost for matching category by any classificationTag
        const catTags = catClassificationTagsMap[catId] || [];
        allKeywords.forEach(w => { if (catTags.includes(w)) score += 0.75; });
      }
      // Extra slight boost if user explicitly referenced category title and this product belongs there
      if (categoryTitleMatchedIds.length && categoryTitleMatchedIds.some(id => id.toString() === catId)) {
        score += 1.25;
      }
    }
    // Light discount signal
    if (p.MRP && p.price) {
      const discountPct = (p.MRP - p.price) / p.MRP;
      if (discountPct > 0.2) score += 1;
    }
    // Popularity boost
    if (requestedSort === 'orders') {
      const c = ordersCountMap[p._id?.toString()] || 0;
      score += Math.min(5, Math.log10(1 + c) * 3); // bounded boost
    }
    return score;
  }

  let scored = effectiveList.map(p => ({ p, score: scoreProduct(p) }));
  // Optional explicit price sort overrides scoring if asked
  if (requestedSort === 'price_asc') {
    scored = scored.sort((a, b) => (a.p.price ?? 0) - (b.p.price ?? 0));
  } else if (requestedSort === 'price_desc') {
    scored = scored.sort((a, b) => (b.p.price ?? 0) - (a.p.price ?? 0));
  } else {
    scored = scored.sort((a, b) => b.score - a.score);
  }
  // Diversification across categories when requested for generic domain-only queries
  if (diversifyCategories && !categoryTitle) {
    const uniqueVariantPerCat = new Map();
    const dedupedForDiversify = [];
    for (const entry of scored) {
      const catKey = entry.p.specificCategory ? String(entry.p.specificCategory) : 'uncategorized';
      const baseKey = entry.p.designGroupId
        ? `dg:${entry.p.designGroupId}`
        : entry.p.pageSlug
          ? `slug:${entry.p.pageSlug.split('-')[0]}`
          : `title:${(entry.p.title || '').toLowerCase()}`;
      if (!uniqueVariantPerCat.has(catKey)) uniqueVariantPerCat.set(catKey, new Set());
      const seenSet = uniqueVariantPerCat.get(catKey);
      if (seenSet.has(baseKey)) {
        continue; // skip additional variants within this category bucket
      }
      seenSet.add(baseKey);
      dedupedForDiversify.push(entry);
    }

    // Group by specificCategory and pick top-per-category round-robin
    const byCat = new Map();
    for (const item of dedupedForDiversify) {
      const key = item.p.specificCategory ? String(item.p.specificCategory) : 'uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(item);
    }
    // Sort each category bucket by score desc (already is), then round-robin sample
    const buckets = Array.from(byCat.values()).map(arr => arr.sort((a,b) => b.score - a.score));
    const diversified = [];
    let i = 0;
    while (diversified.length < Math.min(10, clampedLimit) && buckets.length) {
      const idx = i % buckets.length;
      const bucket = buckets[idx];
      const next = bucket.shift();
      if (next) {
        diversified.push(next);
      }
      // Remove empty buckets
      if (bucket.length === 0) {
        buckets.splice(idx, 1);
        continue;
      }
      i++;
    }
    scored = diversified;
  }

  // Apply selectBest to return only top N products (server-side filtering for "show best 2" type requests)
  let finalLimit = diversifyCategories ? Math.min(10, clampedLimit) : clampedLimit;
  if (typeof selectBest === 'number' && selectBest > 0 && selectBest <= 10) {
    finalLimit = selectBest;
  }
  scored = scored.slice(0, finalLimit);

  const products = scored.map(({ p }) => {
    const firstImage = Array.isArray(p.images) && p.images.length ? buildImageUrl(p.images[0]) : null;
    const discount = p.MRP && p.MRP > p.price ? Math.round(((p.MRP - p.price)/p.MRP)*100) : 0;
    const safeSlug = typeof p.pageSlug === 'string' ? p.pageSlug : '';
    const slug = safeSlug.startsWith('/shop') ? safeSlug : `/shop${safeSlug.startsWith('/') ? safeSlug : '/' + safeSlug}`;
    const orderCount = ordersCountMap[p._id?.toString()];
    return {
      title: p.title,
      price: p.price,
      mrp: p.MRP,
      discountPercent: discount,
      image: firstImage,
      slug,
      ...(orderCount !== undefined ? { orderCount } : {}),
    };
  });

  // hasMore: if we over-fetched more than page size after gating, there's more to show
  const hasMore = effectiveList.length > finalLimit;

  // Fallback broadening: if no products but we had keywords, retry without keyword AND constraints once
  if (!products.length && (kwFromQuery.length || explicitKeywords.length)) {
    // Re-run with keywords cleared
    return await searchProducts({
      query: undefined,
      maxPrice: effMax,
      minPrice: effMin,
      categoryTitle,
      keywords: [],
      page,
      limit: clampedLimit,
      sortBy: requestedSort,
      pageContext
    });
  }

  // Final fallback: if still no products, suggest browsing categories (handled by API planner/UI)
  if (!products.length) {
    // Try a popularity-based relaxed fallback for queries that imply popularity
    const impliesPopularity = requestedSort === 'orders' || /popular|best|top|bestselling|selling|trending|hot/i.test(query || '');
    if (impliesPopularity) {
      // Build a relaxed candidate pool similar to initial ORs for keywords, but only ensure product available != false
      const orClauses = [];
      const wordsForFallback = effectiveRequired.length ? effectiveRequired : allKeywords;
      if (wordsForFallback.length) {
        wordsForFallback.slice(0,3).forEach(word => {
          const reg = new RegExp(word, 'i');
          orClauses.push(
            { title: reg },
            { searchKeywords: reg },
            { mainTags: reg },
            { pageSlug: reg }
          );
        });
      }
      const baseMatch = orClauses.length ? { $or: orClauses } : {};
      const relaxedPool = await Product.find({ available: { $ne: false }, ...baseMatch })
        .select('title price MRP images pageSlug specificCategory specificCategoryVariant')
        .limit(clampedLimit * 6) // fetch a bit more to rank by orders
        .lean();
      if (relaxedPool.length) {
        // Enforce category/variant availability even in popularity relaxed mode
        const poolCatIds = [...new Set(relaxedPool.filter(p => p.specificCategory).map(p => p.specificCategory))];
        const poolVarIds = [...new Set(relaxedPool.filter(p => p.specificCategoryVariant).map(p => p.specificCategoryVariant))];
        const [poolCats, poolVars] = await Promise.all([
          poolCatIds.length ? SpecificCategory.find({ _id: { $in: poolCatIds } }).select('_id available').lean() : [],
          poolVarIds.length ? SpecificCategoryVariant.find({ _id: { $in: poolVarIds } }).select('_id available').lean() : []
        ]);
        const poolCatAvail = Object.fromEntries(poolCats.map(c => [c._id.toString(), c.available !== false]));
        const poolVarAvail = Object.fromEntries(poolVars.map(v => [v._id.toString(), v.available !== false]));
        const availFilteredPool = relaxedPool.filter(p => {
          if (p.specificCategory && poolCatAvail[p.specificCategory.toString()] === false) return false;
          if (p.specificCategoryVariant && poolVarAvail[p.specificCategoryVariant.toString()] === false) return false;
          return true;
        });
        if (!availFilteredPool.length) {
          // If all are filtered out by availability, fall through to category fallback
          return {
            page: Math.max(1, page),
            limit: clampedLimit,
            products: [],
            hasMore: false,
            totalApprox: 0,
            queryEcho: { query, maxPrice: effMax, minPrice: effMin, keywords: allKeywords, sortBy: requestedSort, popularityRelaxed: true, availabilityGated: true },
            continuation: null,
            fallback: 'browse_categories'
          };
        }
        const ids = relaxedPool.map(p => p._id);
        const agg = await Order.aggregate([
          { $match: { 'items.product': { $in: ids } } },
          { $unwind: '$items' },
          { $match: { 'items.product': { $in: ids } } },
          { $group: { _id: '$items.product', count: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
          { $sort: { count: -1 } },
          { $limit: clampedLimit }
        ]);
        const topIds = agg.map(a => a._id.toString());
        let top = availFilteredPool.filter(p => topIds.includes(p._id.toString()));
        // If aggregation returned none, just take first N of relaxed pool
        if (!top.length) top = availFilteredPool.slice(0, clampedLimit);
        const productsFallback = top.map((p) => {
          const firstImage = Array.isArray(p.images) && p.images.length ? buildImageUrl(p.images[0]) : null;
          const discount = p.MRP && p.MRP > p.price ? Math.round(((p.MRP - p.price)/p.MRP)*100) : 0;
          const safeSlug = typeof p.pageSlug === 'string' ? p.pageSlug : '';
          const slug = safeSlug.startsWith('/shop') ? safeSlug : `/shop${safeSlug.startsWith('/') ? safeSlug : '/' + safeSlug}`;
          return { title: p.title, price: p.price, mrp: p.MRP, discountPercent: discount, image: firstImage, slug };
        });
        if (productsFallback.length) {
          return {
            page: Math.max(1, page),
            limit: clampedLimit,
            products: productsFallback,
            hasMore: false,
            totalApprox: productsFallback.length,
            queryEcho: { query, maxPrice: effMax, minPrice: effMin, keywords: allKeywords, sortBy: requestedSort, popularityRelaxed: true },
            continuation: null
          };
        }
      }
    }
    return {
      page: Math.max(1, page),
      limit: clampedLimit,
      products: [],
      hasMore: false,
      totalApprox: 0,
      queryEcho: { query, maxPrice: effMax, minPrice: effMin, keywords: allKeywords, sortBy: requestedSort, relaxedInventoryTried: usedRelaxedInventory },
      continuation: null,
      fallback: 'browse_categories'
    };
  }

  const result = {
    page: Math.max(1, page),
    limit: diversifyCategories ? Math.min(10, clampedLimit) : clampedLimit,
    products,
    hasMore,
    totalApprox: filtered.length,
    queryEcho: {
      query,
      maxPrice: effMax,
      minPrice: effMin,
      keywords: allKeywords,
      categoryTitle: categoryTitle || null,
      classificationTags: explicitClassificationTags.length ? explicitClassificationTags : null,
      excludeTags: explicitExcludeTags.length ? explicitExcludeTags : null,
      sortBy: requestedSort,
      diversifyCategories: !!diversifyCategories,
      page: Math.max(1, page),
    },
    continuation: {
      page: Math.max(1, page),
      limit: diversifyCategories ? Math.min(10, clampedLimit) : clampedLimit,
      filters: {
        query: query || null,
        keywords: allKeywords,
        maxPrice: effMax ?? null,
        minPrice: effMin ?? null,
        categoryTitle: categoryTitle || null,
        classificationTags: explicitClassificationTags.length ? explicitClassificationTags : null,
        excludeTags: explicitExcludeTags.length ? explicitExcludeTags : null,
        sortBy: requestedSort || null,
        diversifyCategories: !!diversifyCategories,
      },
      hint: hasMore ? 'Say "show more" to see additional results.' : null,
    }
  };
  return result;
}

export async function categoryFirstSuggestions({ limit = 6 }) {
  await connectToDb();
  const clampedLimit = clampLimit(limit);
  const cats = await SpecificCategory.find({ available: { $ne: false } })
    .select('_id name title available inventoryMode')
    .lean();

  // For each category find one representative product (first by price ascending) with availability
  const results = [];
  for (const c of cats) {
    // Fetch a small pool and post-filter for variant availability and inventory stock when needed
    const pool = await Product.find({ specificCategory: c._id, available: { $ne: false } })
      .select('title price MRP images pageSlug productSource inventoryData options specificCategoryVariant')
      .sort({ price: 1 })
      .limit(6)
      .lean();
    if (!pool.length) continue;

    const varIds = [...new Set(pool.filter(p => p.specificCategoryVariant).map(p => p.specificCategoryVariant))];
    const varDocs = varIds.length ? await SpecificCategoryVariant.find({ _id: { $in: varIds } }).select('_id available').lean() : [];
    const varAvail = Object.fromEntries(varDocs.map(v => [v._id.toString(), v.available !== false]));

    // Inventory gating if category is inventory-managed
    const requiresInventory = c.inventoryMode === 'inventory';
    let invMap = {};
    if (requiresInventory) {
      const invIds = [];
      pool.forEach(p => {
        if (p.inventoryData) invIds.push(p.inventoryData);
        if (Array.isArray(p.options)) p.options.forEach(o => { if (o.inventoryData) invIds.push(o.inventoryData); });
      });
      const invDocs = invIds.length ? await Inventory.find({ _id: { $in: invIds } }).select('_id availableQuantity').lean() : [];
      invMap = Object.fromEntries(invDocs.map(d => [d._id.toString(), d.availableQuantity]));
    }

    const filteredPool = pool.filter(p => {
      if (p.specificCategoryVariant && varAvail[p.specificCategoryVariant.toString()] === false) return false;
      if (requiresInventory) {
        let inStock = false;
        if (p.inventoryData && invMap[p.inventoryData.toString()] > 0) inStock = true;
        if (!inStock && Array.isArray(p.options)) {
          inStock = p.options.some(o => o.inventoryData && invMap[o.inventoryData.toString()] > 0);
        }
        if (!inStock) return false;
      }
      return true;
    });

    if (filteredPool[0]) results.push(filteredPool[0]);
    if (results.length >= clampedLimit) break;
  }

  const products = results.map(p => {
    const firstImage = Array.isArray(p.images) && p.images.length ? buildImageUrl(p.images[0]) : null;
    const discount = p.MRP && p.MRP > p.price ? Math.round(((p.MRP - p.price)/p.MRP)*100) : 0;
    const slug = p.pageSlug.startsWith('/shop') ? p.pageSlug : `/shop${p.pageSlug.startsWith('/') ? p.pageSlug : '/' + p.pageSlug}`;
    return {
      title: p.title,
      price: p.price,
      mrp: p.MRP,
      discountPercent: discount,
      image: firstImage,
      slug,
    };
  });

  return { products, hasMore: false, page: 1, limit: clampedLimit };
}
