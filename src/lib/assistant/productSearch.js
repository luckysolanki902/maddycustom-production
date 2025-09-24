// Product search utility for assistant function-calling
// Applies availability, inventory, price, and keyword filters with pagination

import connectToDb from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Inventory from '@/models/Inventory';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

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
  'show','some','find','suggest','recommend','get','need','want','see','me','for','a','an','the','please','pls','with','and','or','to','of','under','below','less','than','over','above','more','rs','price','cost','in','on','at','any'
]);
// Words we consider too generic in automotive context (optionally removable)
const GENERIC_DOMAIN = new Set(['car','bike','window','vehicle','model','size','sizes']);

function extractKeywords(q) {
  if (!q) return [];
  const raw = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const filtered = raw.filter(w => w.length > 2 && !STOPWORDS.has(w) && !GENERIC_DOMAIN.has(w));
  return [...new Set(filtered)];
}

export async function searchProducts({
  query,
  maxPrice,
  minPrice,
  categoryTitle,
  keywords,
  page = 1,
  limit,
  pageContext,
}) {
  await connectToDb();
  const clampedLimit = clampLimit(limit);
  const skip = (Math.max(1, page) - 1) * clampedLimit;

  const kwFromQuery = extractKeywords(query);
  const explicitKeywords = normalizeArray(keywords).map(k => k.toLowerCase()).filter(k => !STOPWORDS.has(k));
  let allKeywords = [...new Set([...kwFromQuery, ...explicitKeywords])];
  // Cap to first 3 to avoid over-constraining AND clauses
  if (allKeywords.length > 3) allKeywords = allKeywords.slice(0,3);

  const priceFilter = {};
  if (typeof maxPrice === 'number') priceFilter.$lte = maxPrice;
  if (typeof minPrice === 'number') priceFilter.$gte = minPrice;

  const andClauses = [{ available: { $ne: false } }];
  if (Object.keys(priceFilter).length) andClauses.push({ price: priceFilter });

  // Title / searchKeywords / mainTags filtering (AND over allKeywords softly)
  if (allKeywords.length) {
    andClauses.push({
      $and: allKeywords.map(word => ({
        $or: [
          { title: { $regex: word, $options: 'i' } },
          { searchKeywords: { $in: [new RegExp(word, 'i')] } },
          { mainTags: { $in: [new RegExp(word, 'i')] } },
        ]
      }))
    });
  }

  // Category context assistance: if pageContext provided with categoryTitle use that to bias result
  let categoryTitleMatchedIds = [];
  if (categoryTitle) {
    // We'll pull matching specific categories first (title/name based)
    const catDocs = await SpecificCategory.find({
      $or: [
        { name: { $regex: categoryTitle, $options: 'i' } },
        { title: { $regex: categoryTitle, $options: 'i' } }
      ],
      available: { $ne: false }
    }).select('_id').lean();
    categoryTitleMatchedIds = catDocs.map(c => c._id);
    if (categoryTitleMatchedIds.length) {
      andClauses.push({ specificCategory: { $in: categoryTitleMatchedIds } });
    }
  }

  // Category classificationTags discovery (broad, influences scoring not filtering)
  let classificationTagMatchedCats = [];
  if (allKeywords.length) {
    classificationTagMatchedCats = await SpecificCategory.find({
      classificationTags: { $in: allKeywords.map(w => new RegExp(w, 'i')) },
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

  const catIds = [...new Set(raw.filter(p => p.specificCategory).map(p => p.specificCategory))];
  const varIds = [...new Set(raw.filter(p => p.specificCategoryVariant).map(p => p.specificCategoryVariant))];

  const [catMapDocs, varMapDocs] = await Promise.all([
    catIds.length ? SpecificCategory.find({ _id: { $in: catIds } }).select('_id available name title classificationTags').lean() : [],
    varIds.length ? SpecificCategoryVariant.find({ _id: { $in: varIds } }).select('_id available name title').lean() : []
  ]);
  const catAvail = Object.fromEntries(catMapDocs.map(c => [c._id.toString(), c.available !== false]));
  const varAvail = Object.fromEntries(varMapDocs.map(v => [v._id.toString(), v.available !== false]));
  const catClassificationTagsMap = Object.fromEntries(catMapDocs.map(c => [c._id.toString(), (c.classificationTags || []).map(t => (t||'').toLowerCase())]));

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
    // Category & variant availability
    if (p.specificCategory && catAvail[p.specificCategory.toString()] === false) return false;
    if (p.specificCategoryVariant && varAvail[p.specificCategoryVariant.toString()] === false) return false;

    // Inventory gating
    if (p.productSource === 'inventory') {
      let inStock = false;
      if (p.inventoryData && invMap[p.inventoryData.toString()] > 0) inStock = true;
      if (!inStock && Array.isArray(p.options)) {
        inStock = p.options.some(o => o.inventoryData && invMap[o.inventoryData.toString()] > 0);
      }
      if (!inStock) return false;
    }
    return true;
  });

  // Scoring
  function scoreProduct(p) {
    let score = 0;
    const lowerTitle = (p.title || '').toLowerCase();
    allKeywords.forEach(w => {
      if (lowerTitle.includes(w)) score += 3;
      if ((p.searchKeywords||[]).some(sk => (sk||'').toLowerCase().includes(w))) score += 2;
      if ((p.mainTags||[]).some(tag => (tag||'').toLowerCase().includes(w))) score += 1.5;
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
    return score;
  }

  const scored = filtered.map(p => ({ p, score: scoreProduct(p) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, clampedLimit);

  const products = scored.map(({ p }) => {
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

  // Basic total estimation (not exact if heavy filtering after limit) – optional separate count query later
  const hasMore = filtered.length > clampedLimit + skip;

  // Fallback broadening: if no products but we had keywords, retry without keyword AND constraints once
  if (!products.length && (kwFromQuery.length || explicitKeywords.length)) {
    // Re-run with keywords cleared
    return await searchProducts({
      query: undefined,
      maxPrice,
      minPrice,
      categoryTitle,
      keywords: [],
      page,
      limit: clampedLimit,
      pageContext
    });
  }

  return {
    page: Math.max(1, page),
    limit: clampedLimit,
    products,
    hasMore,
    totalApprox: filtered.length,
    queryEcho: { query, maxPrice, minPrice, keywords: allKeywords }
  };
}

export async function categoryFirstSuggestions({ limit = 6 }) {
  await connectToDb();
  const clampedLimit = clampLimit(limit);
  const cats = await SpecificCategory.find({ available: { $ne: false } })
    .select('_id name title available')
    .lean();

  // For each category find one representative product (first by price ascending) with availability
  const results = [];
  for (const c of cats) {
    const prod = await Product.find({ specificCategory: c._id, available: { $ne: false } })
      .select('title price MRP images pageSlug productSource inventoryData options')
      .sort({ price: 1 })
      .limit(1)
      .lean();
    if (prod[0]) {
      results.push(prod[0]);
    }
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
