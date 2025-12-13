'use client';
/**
 * FuelCapWrapAddOns (frontend-only initial version)
 * Provides a fast, paginated, cached list of low-cost add-ons for a base variant code (default 'FCP').
 * First add-to-cart is intercepted to ensure letter-mapping confirmation.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import AddToCartButton from '@/components/utils/AddToCartButton';
import LetterMappingPopup from '@/components/dialogs/LetterMappingPopup';
import funnelClient from '@/lib/analytics/funnelClient';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { setPreferredVariant } from '@/store/slices/variantPreferenceSlice';

const PAGE_SIZE = 6;
const cache = new Map(); // runtime cache
const sessionCacheKey = (code) => `fc_addons_${code}`;
const FUEL_CAP_SPEC_CAT_ID = '67af289078259b187eff13b8';

function useIntersection(callback) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) callback(); });
    }, { rootMargin: '300px 0px 300px 0px' });
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [callback]);
  return ref;
}

export default function FuelCapWrapAddOns({ initialVariantCode = 'FCP', pageSize = PAGE_SIZE, similarityContext = null }) {
  const dispatch = useDispatch();
  const pref = useSelector(s => s.variantPreference?.[FUEL_CAP_SPEC_CAT_ID]);
  const [availableVariants, setAvailableVariants] = useState([]); // {_id, variantCode}
  const [mappingGroups, setMappingGroups] = useState([]); // from specific category
  const [baseCode, setBaseCode] = useState('F');
  const [variantCode, setVariantCode] = useState(pref?.variantCode || initialVariantCode);
  const [pages, setPages] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMapping, setShowMapping] = useState(false);
  const [mappingConfirmed, setMappingConfirmed] = useState(Boolean(pref?.preferredVariantId));
  const [initialReady, setInitialReady] = useState(false);
  // once mapping confirmed we allow real AddToCartButtons

  const sliderRef = useRef(null);
  const prefetchingRef = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const flatProducts = Object.values(pages).flat();

  const fetchPage = useCallback(async (targetPage, { prefetch = false } = {}) => {
    if (loading) return;
    if (!hasMore && targetPage !== 1) return;
    const cacheEntry = cache.get(variantCode);
    if (cacheEntry && cacheEntry.pages[targetPage]) {
      setPages(prev => ({ ...prev, [targetPage]: cacheEntry.pages[targetPage] }));
      const total = cacheEntry.total;
      setHasMore(total == null || Object.values(cacheEntry.pages).flat().length < total);
      if (targetPage === 1) setInitialReady(true);
      return;
    }
    try {
      if (!prefetch) setLoading(true);
      setError(null);
      // Build URL with optional similarity snapshot (only on first load / subsequent fetches reuse same values)
      const params = new URLSearchParams({ variantCode, page: String(targetPage), pageSize: String(pageSize) });
      if (similarityContext?.designGroupIds?.length) {
        params.set('designGroupIds', similarityContext.designGroupIds.join(','));
      }
      if (similarityContext?.nameTokens?.length) {
        params.set('nameTokens', similarityContext.nameTokens.join(','));
      }
      const res = await fetch(`/api/showcase/fuel-cap-wrap-addons?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const products = data.products || [];
      setPages(prev => ({ ...prev, [targetPage]: products }));
      const total = data.total || null;
      cache.set(variantCode, { pages: { ...(cacheEntry?.pages || {}), [targetPage]: products }, total });
      const updated = cache.get(variantCode);
      setHasMore(total == null ? products.length === pageSize : (Object.values(updated.pages).flat().length < total));
      // Persist to sessionStorage for quick revisit within session
      try {
        const toStore = { total: updated.total, pages: updated.pages, ts: Date.now() };
        sessionStorage.setItem(sessionCacheKey(variantCode), JSON.stringify(toStore));
      } catch {}
      // Proactively prefetch next page if we likely have more
      if (targetPage === 1 && (total == null || products.length === pageSize)) {
        fetchPage(2, { prefetch: true });
      }
    } catch (err) {
      console.warn('[FuelCapWrapAddOns] fetch fallback (likely endpoint missing):', err.message);
      setError(err.message);
      setHasMore(false);
    } finally {
      if (!prefetch) setLoading(false);
      if (targetPage === 1) setInitialReady(true);
    }
  }, [variantCode, pageSize, loading, hasMore, similarityContext]);

  // Load variants & mapping groups
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/variants/by-specific-category?id=${FUEL_CAP_SPEC_CAT_ID}`);
        if (!res.ok) return; const data = await res.json();
        setAvailableVariants(data.variants || []);
        if (data?.specificCategory?.code) setBaseCode(String(data.specificCategory.code).toUpperCase());
        if (data?.specificCategory?.useLetterMapping) setMappingGroups(data.specificCategory.letterMappingGroups || []);
        // Respect incoming initialVariantCode, but ensure it exists in available variants; else fallback to first
        if (!pref?.preferredVariantId && (data.variants || []).length > 0) {
          const normalizedInit = String(initialVariantCode || '').toUpperCase();
          const matchInit = (data.variants || []).find(v => String(v.variantCode).toUpperCase() === normalizedInit);
          const chosen = matchInit || data.variants[0];
          setVariantCode(chosen.variantCode);
          dispatch(setPreferredVariant({ categoryId: FUEL_CAP_SPEC_CAT_ID, variantId: chosen._id, variantCode: chosen.variantCode }));
          setMappingConfirmed(true);
        }
      } catch (e) { console.warn('Variant meta load failed', e.message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPages({}); setPage(1); setHasMore(true); setInitialReady(false);
    // Try sessionStorage first
    try {
      const raw = sessionStorage.getItem(sessionCacheKey(variantCode));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.pages) {
          cache.set(variantCode, { pages: parsed.pages, total: parsed.total });
          setPages(parsed.pages);
          const totalLoaded = Object.values(parsed.pages).flat().length;
          setHasMore(parsed.total == null ? true : totalLoaded < parsed.total);
          setInitialReady(true);
          // Still silently prefetch next page if page 1 exists
          if (parsed.pages[1]) fetchPage(2, { prefetch: true });
          return; // skip fresh fetch
        }
      }
    } catch {}
    fetchPage(1);
  }, [variantCode, fetchPage]);

  const loadMoreRef = useIntersection(() => {
    if (!loading && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchPage(next);
    }
  });

  // When user decides to map manually via button
  const openMapping = () => {
    setShowMapping(true);
    try { funnelClient.track('mapping_start', { metadata: { component: 'FuelCapWrapAddOns', currentVariant: variantCode } }); } catch {}
  };

  const handleMappingSubmit = ({ finalCode }) => {
    setShowMapping(false);
    const code = finalCode || variantCode;
    const match = availableVariants.find(v => v.variantCode?.toLowerCase() === code.toLowerCase());
    if (match) {
      setVariantCode(match.variantCode);
      setMappingConfirmed(true);
      dispatch(setPreferredVariant({ categoryId: FUEL_CAP_SPEC_CAT_ID, variantId: match._id, variantCode: match.variantCode }));
      try { funnelClient.track('mapping_submit', { metadata: { previousCode: variantCode, finalCode: match.variantCode } }); } catch {}
    } else {
      setMappingConfirmed(false);
      try { funnelClient.track('mapping_submit', { metadata: { previousCode: variantCode, finalCode: code, unmatched: true } }); } catch {}
    }
  };

  const recalcScrollState = () => {
    const el = sliderRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 8);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 8);
  };

  useEffect(() => { recalcScrollState(); }, [flatProducts.length, mappingConfirmed]);
  // Scroll listener to prefetch when user nears end
  useEffect(() => {
    const el = sliderRef.current; if (!el) return;
    const handle = () => {
      if (!hasMore || loading || prefetchingRef.current) return;
      const reachPoint = el.scrollWidth * 0.65; // 65% width
      if (el.scrollLeft + el.clientWidth >= reachPoint) {
        prefetchingRef.current = true;
        const next = page + 1;
        fetchPage(next, { prefetch: true }).finally(() => { prefetchingRef.current = false; });
      }
    };
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, [page, hasMore, loading, fetchPage]);
  const scrollBy = (delta) => {
    const el = sliderRef.current; if (!el) return; el.scrollBy({ left: delta, behavior: 'smooth' });
  };
  useEffect(() => {
    const el = sliderRef.current; if (!el) return;
    const handler = () => recalcScrollState();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Map variant code letters back to readable labels using mappingGroups (assumes order)
  const readableVariant = (() => {
    if (!mappingGroups.length || !variantCode) return variantCode;
    try {
      const code = String(variantCode).toUpperCase();
      const base = String(baseCode || '').toUpperCase();
      const suffix = code.startsWith(base) ? code.slice(base.length) : code;
      const letters = suffix.split('');
      const parts = [];
      // Ensure mapping order is predictable: usually [shape, fuel]
      for (let i = 0; i < mappingGroups.length; i++) {
        const group = mappingGroups[i];
        const letter = letters[i] || '';
        if (!group || !Array.isArray(group.mappings)) continue;
        const opt = group.mappings.find(m => String(m.letterCode).toUpperCase() === letter);
        if (opt?.name) parts.push(opt.name);
      }
      return parts.length ? parts.join(' • ') : variantCode;
    } catch {
      return variantCode;
    }
  })();

  // Prefetch page 1 as soon as cart has items so users never see skeletons
  const cartItems = useSelector(s => s.cart?.items || []);
  const cartQty = cartItems.reduce((n, it) => n + (it.quantity || 0), 0);
  // Get first cart item name for personalized subtitle
  const firstCartItemName = cartItems[0]?.name?.split(' ')[0] || 'your';
  useEffect(() => {
    if (cartQty > 0) {
      // Try to hydrate from session cache first; otherwise fetch immediately
      try {
        const raw = sessionStorage.getItem(sessionCacheKey(variantCode));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.pages && parsed.pages[1]) {
            cache.set(variantCode, { pages: parsed.pages, total: parsed.total });
            setPages(parsed.pages);
            setHasMore(parsed.total == null ? true : Object.values(parsed.pages).flat().length < (parsed.total || 0));
            setInitialReady(true);
            return;
          }
        }
      } catch {}
      // Silent prefetch of first page
      fetchPage(1, { prefetch: true });
    }
  }, [cartQty, variantCode, fetchPage]);

  if (!initialReady) {
    return null;
  }

  return (
    <Box sx={{ mt: 1.5, mb: 1 }}>
      {/* Minimal header with variant selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#2d2d2d' }}>
          Add a matching fuel cap wrap
        </Typography>
        {!mappingConfirmed ? (
          <Button
            size="small"
            variant="outlined"
            onClick={openMapping}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.7rem', 
              py: 0.25, 
              px: 1, 
              borderRadius: '12px',
              borderColor: '#2d2d2d',
              color: '#2d2d2d',
              '&:hover': { borderColor: '#000', background: 'rgba(0,0,0,0.04)' }
            }}
          >
            Choose Type
          </Button>
        ) : (
          <>
            <Chip 
              size="small" 
              label={readableVariant} 
              sx={{ height: '20px', fontSize: '0.65rem', fontWeight: 500 }} 
            />
            <Button 
              size="small" 
              onClick={openMapping} 
              sx={{ textTransform: 'none', fontSize: '0.65rem', p: 0, minWidth: 'auto', color: '#6b7280' }}
            >
              Change
            </Button>
          </>
        )}
      </Box>

      {/* Horizontal scroll - 2.2 cards visible */}
      <Box
        ref={sliderRef}
        sx={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {flatProducts.map((p, idx) => {
          const rawFirstImage = Array.isArray(p.images) ? p.images[0] : null;
          const firstImage = typeof rawFirstImage === 'string' ? rawFirstImage.trim() : '';
          const firstImageSrc = firstImage
            ? (firstImage.startsWith('http')
              ? firstImage
              : (process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '') + (firstImage.startsWith('/') ? firstImage : '/' + firstImage))
            : '';
          const isBestMatch = idx === 0;

          return (
            <Box
              key={p._id}
              sx={{
                flex: '0 0 130px',
                scrollSnapAlign: 'start',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#f8f8f8',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Image */}
              <Box sx={{ width: '100%', aspectRatio: '1 / 1', background: '#f8f8f8', overflow: 'hidden', position: 'relative' }}>
                {firstImageSrc && (
                  <Image
                    src={firstImageSrc}
                    alt={p.name}
                    fill
                    sizes="130px"
                    style={{ objectFit: 'cover' }}
                  />
                )}
                {/* Best match badge overlay */}
                {isBestMatch && (
                  <Box sx={{ position: 'absolute', top: 4, left: 4, background: '#2d2d2d', borderRadius: '4px', px: 0.5, py: 0.15 }}>
                    <Typography sx={{ fontSize: '0.55rem', color: '#fff', fontWeight: 600 }}>Best match</Typography>
                  </Box>
                )}
              </Box>

              {/* Content - compact */}
              <Box sx={{ p: '6px', display: 'flex', flexDirection: 'column', gap: '1px', background: '#fff' }}>
                {/* Name - 1 line */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: '#2d2d2d',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p.name}
                >
                  {p.name}
                </Typography>

                {/* Price */}
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#2d2d2d' }}>
                  ₹{p.price}
                </Typography>

                {/* Add button */}
                <Box sx={{ mt: '2px' }}>
                  {mappingConfirmed ? (
                    <AddToCartButton
                      product={{
                        ...p,
                        selectedOption: Array.isArray(p.options) && p.options.length > 0 ? p.options[0] : null,
                      }}
                      isBlackButton
                      smaller
                      fuelAddonStyle
                      insertionDetails={{ component: 'FuelCapWrapAddOns', source: 'cart_addons', pageType: 'viewcart' }}
                      hideRecommendationPopup
                      disableRecommendationTrigger
                      disableNotifyMe
                      customLabel="+ Add"
                      customAddedLabel="✓ Added"
                    />
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={openMapping}
                      sx={{
                        width: '100%',
                        textTransform: 'none',
                        background: '#2d2d2d',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        py: 0.5,
                        borderRadius: '6px',
                        '&:hover': { background: '#1a1a1a' }
                      }}
                    >
                      + Add
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}

        {/* Empty state */}
        {!loading && flatProducts.length === 0 && (
          <Box sx={{ flex: '0 0 100%', textAlign: 'center', py: 2 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af' }}>No matching wraps available</Typography>
          </Box>
        )}

        {/* Sentinel for infinite load */}
        {hasMore && <Box ref={loadMoreRef} sx={{ flex: '0 0 1px', alignSelf: 'stretch' }} />}
      </Box>

      {/* Mapping popup - only shown when needed */}
      <LetterMappingPopup
        open={showMapping}
        onClose={() => setShowMapping(false)}
        onSubmit={handleMappingSubmit}
        baseCode={baseCode}
        groups={mappingGroups}
        title="Select Fuel Cap Type"
        submitLabel="Confirm"
      />
    </Box>
  );
}
