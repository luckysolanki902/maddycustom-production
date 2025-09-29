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
  'product','products','item','items'
]);
// Words we consider too generic in automotive context (optionally removable)
const GENERIC_DOMAIN = new Set(['car','bike','window','vehicle','model','size','sizes']);

function extractKeywords(q) {
  if (!q) return [];
  // Normalize common plurals for better DB matching
  const normalized = q
    .toLowerCase()
    .replace(/\bwraps\b/g, 'wrap');
  const raw = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const filtered = raw.filter(w => w.length > 2 && !STOPWORDS.has(w) && !GENERIC_DOMAIN.has(w));
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
  page = 1,
  limit,
  sortBy,
  pageContext,
}) {
  console.log('[temp-debug] searchProducts start', { query, maxPrice, minPrice, categoryTitle, keywords, page, limit, sortBy });
  await connectToDb();
  // If limit isn't explicitly provided, try to derive from query text
  const hints = parseQueryHints(query);
  console.log('[temp-debug] searchProducts hints', hints);
  const appliedLimit = limit ?? hints.limit;
  const clampedLimit = clampLimit(appliedLimit);
  const skip = (Math.max(1, page) - 1) * clampedLimit;

  const kwFromQuery = extractKeywords(query);
  const explicitKeywords = normalizeArray(keywords).map(k => k.toLowerCase()).filter(k => !STOPWORDS.has(k));
  let allKeywords = [...new Set([...kwFromQuery, ...explicitKeywords])];
  // Cap to first 3 to avoid over-constraining AND clauses
  if (allKeywords.length > 3) allKeywords = allKeywords.slice(0,3);

  // Domain intent detection from the raw text (do not rely on keyword extraction that removes generic domains)
  const rawText = `${query || ''} ${categoryTitle || ''}`.toLowerCase();
  const wantsBike = /\bbike(s)?\b/.test(rawText);
  const wantsCar = /\bcar(s)?\b/.test(rawText);
  const wantsInterior = /\binterior(s)?\b/.test(rawText);
  const wantsExterior = /\bexterior(s)?\b/.test(rawText);

  // Identify structural (category-like) tokens that we want to enforce strictly
  const STRUCTURAL_TOKENS = new Set(['wrap','wraps','pillar','tank','fragrance','perfume','scent','keychain','sticker','decal']);
  const requiredWords = allKeywords.filter(w => STRUCTURAL_TOKENS.has(w)).slice(0, 2);
  // If we didn't detect any structural tokens, require the first keyword only (if any)
  const fallbackRequired = (!requiredWords.length && allKeywords.length) ? [allKeywords[0]] : [];
  const effectiveRequired = requiredWords.length ? requiredWords : fallbackRequired;
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
  }
  console.log('[temp-debug] searchProducts filters', { effectiveRequired, optionalWords, priceFilter, categoryTitle, skip, clampedLimit });

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
    }).select('_id subCategory classificationTags').lean();
    categoryTitleMatchedIds = catDocs.map(c => c._id);
    if (categoryTitleMatchedIds.length) {
      andClauses.push({ specificCategory: { $in: categoryTitleMatchedIds } });
    }
  }

  // Domain filter: if user clearly asked for bike vs car and not both, constrain Product.subCategory
  if (wantsBike && !wantsCar) {
    andClauses.push({ subCategory: { $regex: /bike/i } });
  } else if (wantsCar && !wantsBike) {
    andClauses.push({ subCategory: { $regex: /car/i } });
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
  const classificationTagMatchedCatIds = new Set(classificationTagMatchedCats.map(c => c._id.toString()));

  const queryMatch = andClauses.length ? { $and: andClauses } : {};

  // Base product find (limit + extra for post-filter)
  const raw = await Product.find(queryMatch)
    .select('title price MRP images pageSlug specificCategory specificCategoryVariant productSource inventoryData searchKeywords mainTags available options')
    .lean()
    .skip(skip)
    .limit(clampedLimit * 2); // over-fetch to allow post filtering of inventory & variant availability
  console.log('[temp-debug] searchProducts raw candidates', raw.length);

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
  console.log('[temp-debug] searchProducts filtered after availability/inventory', filtered.length);

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
      console.log('[temp-debug] searchProducts using RELAXED inventory fallback count=', relaxed.length);
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
    console.log('[temp-debug] searchProducts popularity aggregation size', agg.length);
  }

  // Scoring
  function scoreProduct(p) {
    let score = 0;
    const lowerTitle = (p.title || '').toLowerCase();
    // Optional words influence ranking more than filtering
    const allForScoring = [...effectiveRequired, ...optionalWords];
    allForScoring.forEach(w => {
      if (lowerTitle.includes(w)) score += 3;
      if ((p.searchKeywords||[]).some(sk => (sk||'').toLowerCase().includes(w))) score += 2;
      if ((p.mainTags||[]).some(tag => (tag||'').toLowerCase().includes(w))) score += 1.75;
      if ((p.pageSlug||'').toLowerCase().includes(w)) score += 1.5;
    });
    // Category classificationTags relevance boost
    if (p.specificCategory) {
      const catId = p.specificCategory.toString();
      if (classificationTagMatchedCatIds.has(catId)) {
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
  scored = scored.slice(0, clampedLimit);

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
  const hasMore = effectiveList.length > clampedLimit;

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
      console.log('[temp-debug] searchProducts attempting popularity RELAXED fallback');
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
      console.log('[temp-debug] popularity relaxed pool size', relaxedPool.length);
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
        console.log('[temp-debug] popularity relaxed pool after cat/var availability', availFilteredPool.length);
        if (!availFilteredPool.length) {
          // If all are filtered out by availability, fall through to category fallback
          console.log('[temp-debug] popularity relaxed pool empty after availability gating');
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
          console.log('[temp-debug] popularity RELAXED fallback success count', productsFallback.length);
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
    limit: clampedLimit,
    products,
    hasMore,
    totalApprox: filtered.length,
  queryEcho: { query, maxPrice: effMax, minPrice: effMin, keywords: allKeywords, sortBy: requestedSort, relaxedInventoryUsed: usedRelaxedInventory },
    continuation: {
      page: Math.max(1, page),
      limit: clampedLimit,
      filters: {
        keywords: allKeywords,
        maxPrice: effMax ?? null,
        minPrice: effMin ?? null,
        categoryTitle: categoryTitle || null,
        sortBy: requestedSort || null,
      },
      hint: hasMore ? 'Say "show more" to see additional results.' : null,
    }
  };
  console.log('[temp-debug] searchProducts final result', { count: result.products.length, hasMore: result.hasMore, page: result.page, limit: result.limit });
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
