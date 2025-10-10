import connectToDb from '@/lib/middleware/connectToDb';
import helpingData from '@/lib/faq/helpingdata';
import ModeOfPayment from '@/models/ModeOfPayment';
import SpecificCategory from '@/models/SpecificCategory';
import SpecificCategoryVariant from '@/models/SpecificCategoryVariant';
import ProductInfoTab from '@/models/ProductInfoTab';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
const revalidate = 360000; // 10 hours for ISR if used in a route
// Cache for 30 minutes in server memory
const CACHE_KEY = '__HELPING_DATA_DYNAMIC__';
const TTL_MS = 30 * 60 * 1000;

// Toggle to enable/disable caching. When disabled, cache is cleared and never read/set.
// When re-enabled, we ensure any old cache is purged so a fresh snapshot is saved.
export const useCache = false;

function getCache() {
  if (!global.__TEMP_CACHE) global.__TEMP_CACHE = Object.create(null);
  return global.__TEMP_CACHE;
}

function getCached() {
  const cache = getCache();
  const it = cache[CACHE_KEY];
  if (!it) return null;
  if (Date.now() - it.ts > TTL_MS) { delete cache[CACHE_KEY]; return null; }
  return it.data;
}

function setCached(data) {
  const cache = getCache();
  cache[CACHE_KEY] = { ts: Date.now(), data };
}

function clearCached() {
  const cache = getCache();
  if (cache && Object.prototype.hasOwnProperty.call(cache, CACHE_KEY)) {
    delete cache[CACHE_KEY];
  }
}

function getCacheEnabledState() {
  return global.__HELPING_DATA_CACHE_ENABLED;
}
function setCacheEnabledState(val) {
  global.__HELPING_DATA_CACHE_ENABLED = !!val;
}

function formatModeName(mode) {
  const name = (mode?.name || '').toLowerCase();
  const online = mode?.configuration?.onlinePercentage ?? 0;
  const cod = mode?.configuration?.codPercentage ?? 0;
  if (online === 100 && cod === 0) return 'Prepaid (Online)';
  if (online === 0 && cod === 100) return 'Cash on Delivery (COD)';
  if (online > 0 && cod > 0) return `Split Payment (${online}% online / ${cod}% COD)`;
  // Fallback to caption or generic
  return mode?.caption || name || 'Payment Mode';
}

function truncateText(str = '', max = 200) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

// Extract plain text from Mixed content fields in ProductInfoTab
function extractPlainText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractPlainText).filter(Boolean).join(' ');
  }
  // EditorJS content support
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
      } else {
        // Skip images, delimiters, embeds and unknowns to avoid noise
        continue;
      }
    }
    return lines;
  };

  if (typeof content === 'object') {
    if (Array.isArray(content.blocks)) {
      return blocksToLines(content.blocks).join('\n');
    }
    // Common patterns: { text: '...' }, { content: '...' }, { items: [...] }
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
  // Ensure no leading /shop prefix duplication
  slug = slug.replace(/^\/+/, '');
  if (slug.toLowerCase().startsWith('shop/')) {
    slug = slug.slice(5);
  }
  return `/shop/${slug}`;
}

export async function getHelpingData() {
  // Manage cache toggle and state transitions
  const prevEnabled = getCacheEnabledState();
  setCacheEnabledState(useCache);
  if (useCache === false) {
    // Ensure old caches vanish when disabled
    clearCached();
  } else if (prevEnabled === false && useCache === true) {
    // Re-enabled: purge any potential old snapshot to force fresh capture
    clearCached();
  }

  // Try cache first (only if enabled), but do not return early so we can still write debug files/logs
  const cached = useCache ? getCached() : null;
  let usedCache = false;

  // Static baseline content and computed sections
  let base = helpingData;
  let categoriesSection = '';
  let paymentModesSection = '';

  if (!cached) {
    try {
      await connectToDb();
    // 1) Live Specific Categories with Tabs & Variants (concise and relevant)
    const cats = await SpecificCategory.find({ available: true })
      .select('_id name productInfoTabs available')
      .sort({ name: 1 })
      .lean();

    if (Array.isArray(cats) && cats.length) {
      const MAX_CATS = 80; // safety limit
      const catSubset = cats.slice(0, MAX_CATS);
      const catIds = catSubset.map(c => c._id);

      // Fetch variants for these categories (available only)
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

      // Identify required tab titles and sources
      const neededTitles = new Set();
      let needVariantTabs = false;
      let needSpecCatTabs = false;
      let needProductTabs = false; // deprecated: we will ignore product-level tabs for helping data
      for (const c of catSubset) {
        const tabs = Array.isArray(c.productInfoTabs) ? c.productInfoTabs : [];
        for (const t of tabs) {
          if (t?.title) neededTitles.add(t.title);
          const src = (t?.fetchSource || '').toLowerCase();
          if (src === 'variant') needVariantTabs = true;
          if (src === 'speccat') needSpecCatTabs = true;
          // Skip product-level tabs in helping data (handled elsewhere in product pages)
        }
      }

      // Prepare scope IDs
      const variantIds = needVariantTabs ? variants.map(v => v._id) : [];

      // Build a single query for ProductInfoTab limited to needed titles & scopes
      const tabScopeOr = [];
      if (needSpecCatTabs && catIds.length) tabScopeOr.push({ specificCategory: { $in: catIds } });
      if (needVariantTabs && variantIds.length) tabScopeOr.push({ specificCategoryVariant: { $in: variantIds } });

      let tabsBySpecCat = new Map(); // catId -> title -> [tabs]
      let tabsByVariant = new Map(); // varId -> title -> [tabs]

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
      for (const c of catSubset) {
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
            // Only for one variant per category: pick the first variant that has content for this tab
            let chosenVariant = null;
            let chosenLines = [];
            for (const v of catVars) {
              const candLines = pickTabLinesFromMap(tabsByVariant, v._id, title);
              if (candLines.length) { chosenVariant = v; chosenLines = candLines; break; }
            }
            if (!chosenVariant && catVars.length) {
              // fall back to first variant even if empty (to keep structure)
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

        // Variants list + links (only if more than one variant)
        if (multiVariant) {
          const vLines = catVars.map(v => {
            const vName = v.title || v.name || 'Variant';
            const link = normalizeShopLinkFromVariantSlug(v.pageSlug);
            return `${vName} — ${link}`;
          });
          lines.push(`  - Variants (${catVars.length}):`);
          lines.push(`    ${vLines.join('; ')}`);
          // No truncation: list all variants as requested
        } else if (catVars.length === 1) {
          // Single variant: consider as direct tab; provide direct link
          const v = catVars[0];
          const link = normalizeShopLinkFromVariantSlug(v.pageSlug);
          if (link) lines.push(`  - Link: ${link}`);
        }
      }

      categoriesSection = `\n\nCategories & Product Info (live)\n${lines.join('\n')}`;
    } else {
      categoriesSection = `\n\nCategories & Product Info (live)\n• Information temporarily unavailable.`;
    }

    // 2) Live Payment Modes
    const modes = await ModeOfPayment.find({ isActive: true }).select('name caption description configuration extraCharge isActive').lean();
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
    } catch (e) {
      categoriesSection = `\n\nCategories & Product Info (live)\n• Information temporarily unavailable.`;
      paymentModesSection = `\n\nCurrent Payment Modes (live)\n• Information temporarily unavailable.`;
    }
  } else {
    usedCache = true;
  }

  const finalText = usedCache ? cached : `${base}${categoriesSection}${paymentModesSection}`;

  // Optional: write the final composed helping data to files for inspection (even if served from cache)
  try {
    const stamp = new Date().toISOString();
    const src = usedCache ? 'cache' : 'fresh';
    const entry = `=== Helping Data (${stamp}) [source: ${src}] ===\n${finalText}\n\n`;

    // 1) Always try OS temp file (works on most hosts)
    const tmpFile = path.join(os.tmpdir(), 'maddy_helping_data.txt');
    await fs.appendFile(tmpFile, entry, { encoding: 'utf8' });

    // 2) In non-production, also save a project-local copy for convenience
    if (process.env.NODE_ENV !== 'production') {
      const localDir = path.join(process.cwd(), 'scripts', 'generated');
      const localFile = path.join(localDir, 'maddy_helping_data.txt');
      try {
        await fs.mkdir(localDir, { recursive: true });
        await fs.appendFile(localFile, entry, { encoding: 'utf8' });
      } catch (e2) {
      }
    }
  } catch (e) {
    // ignore fs errors in serverless or read-only environments
  }

  // Update/refresh cache timestamp (helps extend TTL on access) only when enabled
  if (useCache) setCached(finalText);
  return finalText;
}

export default getHelpingData;
