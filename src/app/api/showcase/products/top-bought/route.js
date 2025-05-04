/* ---------------------------------------------------------------------- */
/* src/app/api/showcase/products/top-bought/route.js                      */
/* ---------------------------------------------------------------------- */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/middleware/connectToDb';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import Product from '@/models/Product';
import Order from '@/models/Order';
import Option from '@/models/Option';

export const revalidate = 36000;              // 10 h edge‑cache
const PAGE_SIZE = 10;
const log = (...a) => console.log('[top‑bought]', ...a);

/* shuffle helper */
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/* enrich: attach options, totalBought, category, variantDetails ---------- */
async function enrichProducts(products, { specCatDoc, scvMap }) {
  if (!products.length) return [];

  const pIds = products.map((p) => p._id);

  // totalBought
  const buys = await Order.aggregate([
    { $match: { 'items.product': { $in: pIds } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', totalBought: { $sum: '$items.quantity' } } },
  ]);
  const buyMap = Object.fromEntries(buys.map((b) => [b._id.toString(), b.totalBought]));

  // options with inventory
  const opts = await Option.find({ product: { $in: pIds } })
    .populate('inventoryData')
    .lean();
  const optMap = {};
  opts.forEach((o) => {
    const k = o.product.toString();
    (optMap[k] ||= []).push(o);
  });
  Object.values(optMap).forEach((arr) =>
    arr.sort(
      (a, b) =>
        (b.inventoryData?.availableQuantity || 0) -
        (a.inventoryData?.availableQuantity || 0),
    ),
  );

  // final shape
  return products
    .map((p) => {
      const scv = scvMap[p.specificCategoryVariant.toString()];
      return {
        ...p,
        totalBought: buyMap[p._id.toString()] || 0,
        category: {
          specificCategoryCode: specCatDoc.specificCategoryCode,
          name: specCatDoc.name,
        },
        variantDetails: {
          available: scv?.available ?? false,
          availableBrands: scv?.availableBrands ?? [],
          name: scv?.name ?? '',
        },
        options: optMap[p._id.toString()] || [],
      };
    })
    .sort(
      (a, b) =>
        b.totalBought - a.totalBought || a.name.localeCompare(b.name),
    );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subCategoriesParam = searchParams.get('subCategories') || '';
  const skip               = parseInt(searchParams.get('skip') || '0', 10);
  const singleVariantCode  = (searchParams.get('singleVariantCode')  || '').trim();
  const singleCategoryCode = (searchParams.get('singleCategoryCode') || '').trim();

  await connectToDatabase();

  /* ─────────────────────────────────────────────────────────────────── */
  /* 1) singleCategoryCode ::::::::::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  if (singleCategoryCode) {
    const sc = await SpecificCategory.findOne({
      specificCategoryCode: singleCategoryCode,
      available: true,
    }).lean();
    if (!sc) return NextResponse.json({ products: [], hasMore: false });

    const variants = await SpecificCategoryVariant.find({
      specificCategory: sc._id,
      available: true,
    }).lean();
    if (!variants.length) return NextResponse.json({ products: [], hasMore: false });

    const scvMap = Object.fromEntries(variants.map((v) => [v._id.toString(), v]));

    const perVariant = await Promise.all(
      variants.map(async (v) => {
        const raw = await Product.find({
          specificCategoryVariant: v._id,
          available: true,
        }).lean();
        return enrichProducts(raw, { specCatDoc: sc, scvMap });
      }),
    );

    /* round‑robin merge */
    const merged = [];
    let idx = 0, more = true;
    while (more) {
      more = false;
      perVariant.forEach((arr) => {
        if (idx < arr.length) {
          merged.push(arr[idx]);
          more = true;
        }
      });
      idx++;
    }

    const slice = merged.slice(skip, skip + PAGE_SIZE + 1);
    return NextResponse.json({
      products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
      hasMore:  slice.length > PAGE_SIZE,
      totalFound: merged.length,
      specificCategoryName: sc.name,
    });
  }

  /* ─────────────────────────────────────────────────────────────────── */
  /* 2) singleVariantCode :::::::::::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  if (singleVariantCode) {
    const scv = await SpecificCategoryVariant.findOne({
      variantCode: singleVariantCode,
      available: true,
    })
      .populate('specificCategory', 'name specificCategoryCode available')
      .lean();
    if (!scv || !scv.specificCategory?.available) {
      return NextResponse.json({ products: [], hasMore: false });
    }

    const sc = scv.specificCategory;
    const scvMap = { [scv._id.toString()]: scv };

    const raw = await Product.find({
      specificCategoryVariant: scv._id,
      available: true,
    }).lean();

    const enriched = await enrichProducts(raw, { specCatDoc: sc, scvMap });
    const slice    = enriched.slice(skip, skip + PAGE_SIZE + 1);

    return NextResponse.json({
      products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
      hasMore:  slice.length > PAGE_SIZE,
      totalFound: enriched.length,
      specificCategoryName: sc.name,
    });
  }

  /* ─────────────────────────────────────────────────────────────────── */
  /* 3) multi‑subcategory (default) ::::::::::::::::::::::::::::::::::::: */
  /* ─────────────────────────────────────────────────────────────────── */
  let subCategories = subCategoriesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!subCategories.length && !singleVariantCode && !singleCategoryCode) {
    return NextResponse.json(
      { error: 'subCategories required when not using singleVariantCode or singleCategoryCode' },
      { status: 400 },
    );
  }

  /* ensure at least 3 subCategories for variety */
  if (subCategories.length < 3) {
    const extras = await SpecificCategory.find({
      available: true,
      subCategory: { $nin: subCategories },
    }).select('subCategory').lean();
    shuffle(extras);
    subCategories = subCategories.concat(
      extras.slice(0, 3 - subCategories.length).map((e) => e.subCategory),
    );
  }

  /* specific categories + variants */
  const specCats = await SpecificCategory.find({
    subCategory: { $in: subCategories },
    available: true,
  }).lean();
  if (!specCats.length) return NextResponse.json({ products: [] });

  const specIds = specCats.map((c) => c._id);
  const scvDocs = await SpecificCategoryVariant.find({
    specificCategory: { $in: specIds },
    available: true,
  }).lean();

  const scvByCat = {};
  scvDocs.forEach((v) => {
    const k = v.specificCategory.toString();
    (scvByCat[k] ||= []).push(v);
  });
  const scvMap = Object.fromEntries(scvDocs.map((v) => [v._id.toString(), v]));

  /* build list per specific category */
  const lists = await Promise.all(
    specCats.map(async (sc) => {
      const variants = scvByCat[sc._id.toString()] || [];
      if (!variants.length) return [];

      const varIds = variants.map((v) => v._id);
      const raw = await Product.find({
        specificCategoryVariant: { $in: varIds },
        available: true,
      }).lean();

      return enrichProducts(raw, { specCatDoc: sc, scvMap });
    }),
  );

  /* round‑robin merge */
  const merged = [];
  let idx = 0, more = true;
  while (more) {
    more = false;
    lists.forEach((arr) => {
      if (idx < arr.length) {
        merged.push(arr[idx]);
        more = true;
      }
    });
    idx++;
  }

  const slice = merged.slice(skip, skip + PAGE_SIZE + 1);
  return NextResponse.json({
    products: slice.length > PAGE_SIZE ? slice.slice(0, PAGE_SIZE) : slice,
    hasMore:  slice.length > PAGE_SIZE,
    totalFound: merged.length,
  });
}
