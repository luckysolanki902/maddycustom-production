import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/middleware/connectToDb';
import Product from '@/models/Product';
import Option from '@/models/Option';
import Inventory from '@/models/Inventory';
import SpecificCategory from '@/models/SpecificCategory';

// Helper to get a stable key for an item
function itemKey({ productId, optionId }) {
  return optionId ? `${productId}:${optionId}` : `${productId}`;
}

// Determine if the product is on-demand (no inventory constraints)
async function isOnDemandProduct(product) {
  try {
    if (product?.specificCategory) {
      const cat = await SpecificCategory.findById(product.specificCategory).lean();
      return (cat?.inventoryMode || 'on-demand') === 'on-demand';
    }
  } catch {}
  return true; // default safe: treat as on-demand if unknown
}

export async function POST(req) {
  try {
  await connectToDatabase();
  const body = await req.json();
  const { items = [], reserve = false } = body; // items: [{ productId, optionId, quantity }]

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, message: 'No items provided' }, { status: 400 });
    }

    const now = Date.now();
    const TTL_MS = 15 * 60 * 1000; // 15 minutes

    const results = [];
    const excludedKeys = [];
    const itemsInfo = {};

    // For each cart line, verify inventory and optionally reserve
    for (const it of items) {
      const { productId, optionId = null, quantity = 1 } = it;
      const key = itemKey({ productId, optionId });

      // Load product and determine inventory mode
      const product = await Product.findById(productId).select('name title images sku inventoryData specificCategory').lean();
      if (!product) {
        excludedKeys.push(key);
        itemsInfo[key] = { productId, optionId, quantity, reason: 'product_missing' };
        continue;
      }

      const onDemand = await isOnDemandProduct(product);
      let invDoc = null;
      let name = product.name || product.title || 'Product';
      let sku = product.sku || '';
      let image = (product.images && product.images[0]) ? `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${product.images[0].startsWith('/') ? '' : '/'}${product.images[0]}` : '';

      if (!onDemand) {
        if (optionId) {
          const option = await Option.findById(optionId).select('sku images inventoryData').lean();
          if (option) {
            invDoc = option.inventoryData ? await Inventory.findById(option.inventoryData).lean() : null;
            sku = option.sku || sku;
            if (option.images?.length) {
              image = `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${option.images[0].startsWith('/') ? '' : '/'}${option.images[0]}`;
            }
          }
        }
        // fallback to product-level inventory
        if (!invDoc && product.inventoryData) {
          invDoc = await Inventory.findById(product.inventoryData).lean();
        }
      }

      if (onDemand) {
        results.push({ key, status: 'ok', reserved: false });
        itemsInfo[key] = { productId, optionId, quantity, reason: 'on_demand', name, image, sku };
        continue;
      }

      if (!invDoc) {
        // No inventory tracking linked; treat as out of stock conservatively
        excludedKeys.push(key);
        itemsInfo[key] = { productId, optionId, quantity, reason: 'no_inventory_ref', name, image, sku };
        continue;
      }

      const available = Math.max(0, Number(invDoc.availableQuantity || 0));

      if (available <= 0 || quantity > available) {
        excludedKeys.push(key);
        itemsInfo[key] = { productId, optionId, quantity, reason: 'insufficient', name, image, sku, available };
        continue;
      }

      // Optionally reserve by bumping reservedQuantity; disabled by default
      if (reserve) {
        await Inventory.updateOne(
          { _id: invDoc._id },
          { $inc: { reservedQuantity: quantity } }
        );
      }

      results.push({ key, status: 'ok', reserved: !!reserve });
      itemsInfo[key] = { productId, optionId, quantity, reason: 'ok', name, image, sku, available };
    }

    const expiresAt = now + TTL_MS;

    const res = NextResponse.json({ ok: true, excludedKeys, itemsInfo, expiresAt });
    // Ensure no caching at the edge or browser for verify endpoint
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (e) {
    console.error('inventory verify error', e);
    return NextResponse.json({ ok: false, message: e.message || 'Server error' }, { status: 500 });
  }
}

// Disable Next.js data caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;