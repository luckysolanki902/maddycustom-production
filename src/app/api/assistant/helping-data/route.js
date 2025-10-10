import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import helpingData from '@/lib/faq/helpingdata';
import ModeOfPayment from '@/models/ModeOfPayment';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import ProductInfoTab from '@/models/ProductInfoTab';

export const revalidate = 86400; // 1 day ISR

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=0, immutable',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=0',
  'Vercel-CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=0'
};

function getMemoryCache() {
  if (!globalThis.__HELPING_DATA_CACHE) {
    globalThis.__HELPING_DATA_CACHE = { payload: null, ts: 0, etag: null };
  }
  return globalThis.__HELPING_DATA_CACHE;
}

function setMemoryCache(payload, etag) {
  const cache = getMemoryCache();
  cache.payload = payload;
  cache.ts = Date.now();
  cache.etag = etag;
}

function getETag(value) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    let hash = 0;
    for (let i = 0; i < data.length; i += 1) {
      hash = (hash << 5) - hash + data[i];
      hash |= 0;
    }
    return `W/"${Math.abs(hash)}"`;
  } catch (_) {
    return null;
  }
}

function formatModeName(mode) {
  const name = (mode?.name || '').toLowerCase();
  const online = mode?.configuration?.onlinePercentage ?? 0;
  const cod = mode?.configuration?.codPercentage ?? 0;
  if (online === 100 && cod === 0) return 'Prepaid (Online)';
  if (online === 0 && cod === 100) return 'Cash on Delivery (COD)';
  if (online > 0 && cod > 0) return `Split Payment (${online}% online / ${cod}% COD)`;
  return mode?.caption || name || 'Payment Mode';
}

function extractPlainText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractPlainText).filter(Boolean).join(' ');
  }
  const stripHtml = (t = '') => String(t).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const blocksToLines = (blocks = []) => {
    const lines = [];
    for (const blk of blocks) {
      if (!blk || typeof blk !== 'object') continue;
      const type = blk.type;
      const data = blk.data || {};
      if (type === 'header') {
        const t = stripHtml(data.text || '');
        if (t) lines.push(t);
      } else if (type === 'paragraph') {
        const t = stripHtml(data.text || '');
        if (t) lines.push(t);
      } else if (type === 'list') {
        const items = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
          const t = stripHtml(it || '');
          if (t) lines.push(`- ${t}`);
        }
      } else if (type === 'quote') {
        const t = stripHtml(data.text || '');
        if (t) lines.push(`"${t}"`);
      } else if (type === 'table') {
        const rows = Array.isArray(data.content) ? data.content : [];
        for (const row of rows) {
          if (Array.isArray(row)) {
            const cells = row.map(c => stripHtml(c || '')).filter(Boolean);
            if (cells.length) lines.push(cells.join(' | '));
          }
        }
      } else if (type === 'checklist') {
        const items = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
          const t = stripHtml(it.text || '');
          if (t) lines.push(`- ${t}`);
        }
      }
    }
    return lines;
  };

  if (typeof content === 'object') {
    if (Array.isArray(content.blocks)) {
      return blocksToLines(content.blocks).join('\n');
    }
    const parts = [];
    if (typeof content.text === 'string') parts.push(stripHtml(content.text));
    if (typeof content.content === 'string') parts.push(stripHtml(content.content));
    if (Array.isArray(content.items)) parts.push(content.items.map(v => stripHtml(v)).join(' '));
    return parts.filter(Boolean).join(' ');
  }
  return '';
}

function normalizeShopLinkFromVariantSlug(pageSlug) {
  if (!pageSlug) return '';
  let slug = String(pageSlug).trim();
  slug = slug.replace(/^\/+/, '');
  if (slug.toLowerCase().startsWith('shop/')) {
    slug = slug.slice(5);
  }
  return `/shop/${slug}`;
}

export async function GET(request) {
  try {
    const cache = getMemoryCache();
    if (cache.payload && Date.now() - cache.ts < ONE_DAY_MS) {
      return NextResponse.json(cache.payload, {
        headers: {
          ...CACHE_HEADERS,
          ...(cache.etag ? { ETag: cache.etag } : {}),
          'X-Assistant-Helping-Data-Cache': 'HIT'
        }
      });
    }

    let base = helpingData;
    let categoriesSection = '';
    let paymentModesSection = '';

    await connectToDb();

    // Parallel fetch of categories and payment modes
    const [cats, modes] = await Promise.all([
      SpecificCategory.find({ available: true })
        .select('_id name productInfoTabs available')
        .sort({ name: 1 })
        .limit(80)
        .lean(),
      ModeOfPayment.find({ isActive: true })
        .select('name caption description configuration extraCharge isActive')
        .lean()
    ]);

    if (Array.isArray(cats) && cats.length) {
      const catIds = cats.map(c => c._id);

      // Compute needed titles and tab types
      const neededTitles = new Set();
      let needVariantTabs = false;
      let needSpecCatTabs = false;
      for (const c of cats) {
        const tabs = Array.isArray(c.productInfoTabs) ? c.productInfoTabs : [];
        for (const t of tabs) {
          if (t?.title) neededTitles.add(t.title);
          const src = (t?.fetchSource || '').toLowerCase();
          if (src === 'variant') needVariantTabs = true;
          if (src === 'speccat') needSpecCatTabs = true;
        }
      }

      // Parallel fetch of variants
      const variants = await SpecificCategoryVariant.find({ specificCategory: { $in: catIds }, available: true })
        .select('_id specificCategory title name pageSlug available')
        .sort({ title: 1, name: 1 })
        .lean();

      const variantsByCat = new Map();
      for (const v of variants) {
        const cid = String(v.specificCategory);
        if (!variantsByCat.has(cid)) variantsByCat.set(cid, []);
        variantsByCat.get(cid).push(v);
      }

      const variantIds = needVariantTabs ? variants.map(v => v._id) : [];
      const tabScopeOr = [];
      if (needSpecCatTabs && catIds.length) tabScopeOr.push({ specificCategory: { $in: catIds } });
      if (needVariantTabs && variantIds.length) tabScopeOr.push({ specificCategoryVariant: { $in: variantIds } });

      let tabsBySpecCat = new Map();
      let tabsByVariant = new Map();

      if (tabScopeOr.length && neededTitles.size) {
        const allTabs = await ProductInfoTab.find({ $or: tabScopeOr, title: { $in: Array.from(neededTitles) } })
          .select('title content specificCategory specificCategoryVariant product')
          .lean();

        for (const t of allTabs) {
          const title = t.title || '';
          if (t.specificCategory) {
            const cid = String(t.specificCategory);
            if (!tabsBySpecCat.has(cid)) tabsBySpecCat.set(cid, new Map());
            const m = tabsBySpecCat.get(cid);
            if (!m.has(title)) m.set(title, []);
            m.get(title).push(t);
          }
          if (t.specificCategoryVariant) {
            const vid = String(t.specificCategoryVariant);
            if (!tabsByVariant.has(vid)) tabsByVariant.set(vid, new Map());
            const m = tabsByVariant.get(vid);
            if (!m.has(title)) m.set(title, []);
            m.get(title).push(t);
          }
        }
      }

      function pickTabLinesFromMap(map, keyId, title) {
        const perTitle = map.get(String(keyId));
        const list = perTitle?.get(title);
        if (list && list.length) {
          const txt = extractPlainText(list[0].content || {});
          const lines = String(txt || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
          return lines;
        }
        return [];
      }

      const lines = [];
      for (const c of cats) {
        lines.push(`• ${c.name}`);
        const catVars = variantsByCat.get(String(c._id)) || [];
        const tabs = Array.isArray(c.productInfoTabs) ? c.productInfoTabs : [];
        const multiVariant = catVars.length > 1;

        for (const tab of tabs) {
          const title = tab?.title || '';
          const src = (tab?.fetchSource || '').toLowerCase();
          if (!title || !src) continue;

          if (src === 'speccat') {
            const tLines = pickTabLinesFromMap(tabsBySpecCat, c._id, title);
            if (tLines.length) {
              lines.push(`  - ${title}:`);
              for (const l of tLines) lines.push(`    ${l}`);
            }
          } else if (src === 'variant') {
            if (!catVars.length) continue;
            let chosenVariant = null;
            let chosenLines = [];
            for (const v of catVars) {
              const candLines = pickTabLinesFromMap(tabsByVariant, v._id, title);
              if (candLines.length) { chosenVariant = v; chosenLines = candLines; break; }
            }
            if (!chosenVariant && catVars.length) {
              chosenVariant = catVars[0];
              chosenLines = pickTabLinesFromMap(tabsByVariant, chosenVariant._id, title);
            }
            if (chosenVariant && chosenLines.length) {
              const vName = chosenVariant.title || chosenVariant.name || 'Variant';
              lines.push(`  - ${title} (${vName}):`);
              for (const l of chosenLines) lines.push(`    ${l}`);
            }
          }
        }

        if (multiVariant) {
          const vLines = catVars.map(v => {
            const vName = v.title || v.name || 'Variant';
            const link = normalizeShopLinkFromVariantSlug(v.pageSlug);
            return `${vName} — ${link}`;
          });
          lines.push(`  - Variants (${catVars.length}):`);
          lines.push(`    ${vLines.join('; ')}`);
        } else if (catVars.length === 1) {
          const v = catVars[0];
          const link = normalizeShopLinkFromVariantSlug(v.pageSlug);
          if (link) lines.push(`  - Link: ${link}`);
        }
      }

      categoriesSection = `\n\nCategories & Product Info (live)\n${lines.join('\n')}`;
    } else {
      categoriesSection = `\n\nCategories & Product Info (live)\n• Information temporarily unavailable.`;
    }

    // 2) Live Payment Modes (already fetched in parallel at the start)
    if (Array.isArray(modes) && modes.length) {
      const lines = modes.map(m => {
        const label = formatModeName(m);
        const details = m?.description ? ` – ${m.description}` : '';
        const cfg = m?.configuration || {};
        const cfgStr = (typeof cfg.onlinePercentage === 'number' || typeof cfg.codPercentage === 'number')
          ? ` [${cfg.onlinePercentage ?? 0}% online / ${cfg.codPercentage ?? 0}% COD]`
          : '';
        const extra = typeof m?.extraCharge === 'number' && m.extraCharge > 0
          ? ` (+₹${m.extraCharge} extra charge)`
          : '';
        return `• ${label}${cfgStr}${extra}${details}`;
      });
      paymentModesSection = `\n\nCurrent Payment Modes (live)\n${lines.join('\n')}\n\nNote: Availability can vary by category or location. This list is auto-updated.`;
    } else {
      paymentModesSection = `\n\nCurrent Payment Modes (live)\n• Information temporarily unavailable.`;
    }

    const finalText = `${base}${categoriesSection}${paymentModesSection}`;
    const payload = { helpingData: finalText };
    const etag = getETag(finalText);
    setMemoryCache(payload, etag);

    return NextResponse.json(payload, {
      headers: {
        ...CACHE_HEADERS,
        ...(etag ? { ETag: etag } : {}),
        'X-Assistant-Helping-Data-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Failed to generate helping data:', error);
    return NextResponse.json(
      { error: 'Failed to generate helping data', helpingData: helpingData },
      { status: 500 }
    );
  }
}
