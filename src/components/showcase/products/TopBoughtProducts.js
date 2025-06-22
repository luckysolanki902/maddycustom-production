'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Skeleton,
  Fade,
  Card,
  CardContent,
  CardMedia,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AddToCartButton from '@/components/utils/AddToCartButton';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const PAGE_SIZE = 10;

/* ─────────────────── styled helpers ─────────────────── */
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(3),
  scrollSnapType: 'x proximity',
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
}));
const Sentinel = styled('div')({ width: 1, height: 1 });
const cardSx = {
  width: 200,
  flexShrink: 0,
  scrollSnapAlign: 'start',
  borderRadius: 3,
  transition: 'transform .2s',
  cursor: 'pointer',
  '&:hover': { transform: 'translateY(-6px)', boxShadow: 6 },
};

/* ─────────────────── image helper ─────────────────── */
const getDisplayImage = (product) => {
  if (product.options?.length) {
    const inStock = product.options.find(
      (o) => o.inventoryData?.availableQuantity > 0 && o.images?.length
    );
    if (inStock) return { imageUrl: inStock.images[0], outOfStock: false };

    const first = product.options.find((o) => o.images?.length);
    if (first) return { imageUrl: first.images[0], outOfStock: true };
  }
  if (product.images?.length)
    return {
      imageUrl: product.images[0],
      outOfStock: product.inventoryData?.availableQuantity <= 0,
    };
  return {
    imageUrl: '/images/assets/gifs/helmetloadinggif.gif',
    outOfStock: true,
  };
};

/* ─────────────────── context ─────────────────── */
const TopBoughtContext = React.createContext();

/* ─────────────────── Base component ─────────────────── */
function TopBoughtProductsBase({
  subCategories = [],        // may be omitted by caller
  currentProductId = '',
  excludeProductIds = [],
  singleVariantCode = '',
  singleCategoryCode = '',
  pageType = '', // Added pageType prop
  hideHeading = false,
}) {
  const router = useRouter();
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const skipRef = useRef(0);
  
  // Create insertion details object
  const insertionDetails = {
    component: 'topBoughtProducts',
    pageType: pageType
  };

  /* ---------- Normalise sub‑categories ---------- */
  // Guarantee an array, even when undefined/null is supplied
  const subCatArr = Array.isArray(subCategories) ? subCategories : [];

  // Fallback default only if no variant/category code is supplied and caller
  // forgot to pass a sub‑category list
  const effectiveSubCats =
    subCatArr.length || singleVariantCode || singleCategoryCode
      ? subCatArr
      : ['Car Wraps', 'Car Care'];

  const subCatKey = useMemo(
    () =>
      [...effectiveSubCats]
        .slice()
        .sort()
        .join('|'), // safe even when array is empty
    [effectiveSubCats]
  );

  /* ---------- State ---------- */
  const [products, setProducts] = useState([]);

  const [hasMore, setHasMore] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [specCatName, setSpecCatName] = useState('');

  /* ---------- De‑dupe set ---------- */
  const seenIds = useRef(
    new Set([...excludeProductIds, currentProductId].filter(Boolean))
  );

  /* ---------- Fetcher ---------- */
  const fetchPage = useCallback(
    async (offset, isInitial) => {
      try {
        isInitial ? setLoadingInit(true) : setLoadingMore(true);

        const params = { skip: offset };
        if (effectiveSubCats.length) {
          params.subCategories = effectiveSubCats.join(',');
        }
        if (singleVariantCode) params.singleVariantCode = singleVariantCode;
        if (singleCategoryCode) params.singleCategoryCode = singleCategoryCode;

        const { data } = await axios.get(
          '/api/showcase/products/top-bought',
          { params }
        );

        let {
          products: fetched = [],
          hasMore: more = false,
          specificCategoryName = '',
        } = data || {};

        if (isInitial && specificCategoryName) {
          setSpecCatName(specificCategoryName);
        }

        /* client‑side exclusion */
        fetched = fetched.filter((p) => !seenIds.current.has(p._id));

        /* if too few, pull next page */
        if (fetched.length < PAGE_SIZE && more) {
          fetched.forEach((p) => seenIds.current.add(p._id));
          const extra = await fetchPage(offset + PAGE_SIZE, false);
          fetched = fetched.concat(extra.fetched);
          more = extra.more;
        }

        const ready = fetched.map((p) =>
          Array.isArray(p.options) && p.options.length
            ? { ...p, selectedOption: p.options[0] }
            : p
        );

        setProducts((prev) =>
          offset === 0 ? ready : [...prev, ...ready]
        );
        ready.forEach((p) => seenIds.current.add(p._id));
        setHasMore(more);

        return { fetched: ready, more };
      } catch (err) {
        console.error('top-bought fetch err:', err);
        return { fetched: [], more: false };
      } finally {
        isInitial ? setLoadingInit(false) : setLoadingMore(false);
      }
    },
    [effectiveSubCats, singleVariantCode, singleCategoryCode]
  );

  /* ---------- Initial load ---------- */
  useEffect(() => {
    skipRef.current = 0;
    setProducts([]);
    setHasMore(false);
    setSpecCatName('');
    seenIds.current = new Set(
      [...excludeProductIds, currentProductId].filter(Boolean)
    );
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSubCats.join('|'), singleVariantCode, singleCategoryCode]);

  /* ---------- Infinite‑scroll observer ---------- */
  useEffect(() => {
    if (!sentinelRef.current || !scrollRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore
        ) {
          const next = skipRef.current + PAGE_SIZE;
          skipRef.current = next;
          fetchPage(next, false);
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, fetchPage]);

  /* ---------- Section title ---------- */
  const sectionTitle =
    (singleVariantCode || singleCategoryCode) && specCatName
      ? specCatName
      : 'Customers also bought';

  /* ─────────────────── Render ─────────────────── */
  return (
    <TopBoughtContext.Provider
    value={{ singleCategoryCode, singleVariantCode, insertionDetails }}
    >
      <Box sx={{ width: '100%', px: 1 }}>
        {!hideHeading && (
          <>
            {loadingInit && !specCatName ? (
              <Skeleton
                variant="text"
                width={200}
                height={32}
                sx={{ mb: 1 }}
              />
            ) : (
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                {sectionTitle}
              </Typography>
            )}
          </>
        )}

        {loadingInit ? (
          <ScrollContainer>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <ProductCardSkeleton key={`skel-${i}`} />
            ))}
          </ScrollContainer>
        ) : (
          <Fade in>
            <ScrollContainer ref={scrollRef}>
              {products.map((p, i) => (
                <ProductCard key={`${p._id}-${i}`} product={p} i={i} />
              ))}
              {loadingMore &&
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={`load-${i}`} />
                ))}
              {hasMore && <Sentinel ref={sentinelRef} />}
            </ScrollContainer>
          </Fade>
        )}
      </Box>
    </TopBoughtContext.Provider>
  );
}

/* ─────────────────── Cards ─────────────────── */
const ProductCard = memo(function ProductCard({ product, i }) {
  const router = useRouter();
  const { imageUrl, outOfStock } = getDisplayImage(product);

  const { insertionDetails, singleCategoryCode, singleVariantCode } =
    React.useContext(TopBoughtContext);

  const thumb = useMemo(
    () =>
      imageUrl.startsWith('/')
        ? `${baseImageUrl}${imageUrl}`
        : `${baseImageUrl}/${imageUrl}`,
    [imageUrl]
  );

  const cartPayload = useMemo(
    () => ({ ...product, thumbnail: thumb }),
    [product, thumb]
  );

  const showCategory = !singleCategoryCode && !singleVariantCode;

  return (
    <Card
      sx={cardSx}
      onClick={() => {
        if (singleVariantCode || singleCategoryCode) {
          const slug = product.pageSlug ?? "";
          const baseSlug = slug.substring(0, slug.lastIndexOf("/"));

          const page = 1 + Math.floor(i / ITEMS_PER_PAGE);

          router.push(`/shop/${baseSlug}?productId=${product._id}&page=${page}`);
          return;
        }

        router.push(`/shop/${product.pageSlug || ''}`)
      }}
    >
      <CardMedia
        sx={{
          position: 'relative',
          pt: '75%',
          filter: outOfStock ? 'grayscale(100%)' : 'none',
        }}
      >
        <Image
          src={thumb}
          alt={product.name || 'product'}
          fill
          sizes="200px"
          style={{ objectFit: 'cover' }}
        />
      </CardMedia>
      <CardContent sx={{ pt: 1.5, pb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Jost', fontWeight: 500 }}
          noWrap
        >
          {product.name}
        </Typography>
        {showCategory && (
          <Typography
            variant="caption"
            sx={{ color: 'rgba(0,0,0,0.5)' }}
            noWrap
          >
            {product.category?.name || product.category}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, mt: 0.5 }}
        >
          ₹{product.price}
        </Typography>
        <AddToCartButton
          fullWidth
          product={cartPayload}
          onClick={(e) => e.stopPropagation()}
          insertionDetails={insertionDetails}
        />
      </CardContent>
    </Card>
  );
});

const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  const { singleCategoryCode, singleVariantCode } =
    React.useContext(TopBoughtContext);
  const showCategory = !singleCategoryCode && !singleVariantCode;

  return (
    <Card sx={cardSx}>
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{ pt: '75%' }}
      />
      <CardContent sx={{ pb: 2 }}>
        <Skeleton variant="text" width="80%" height={20} />
        {showCategory && (
          <Skeleton variant="text" width="60%" height={18} />
        )}
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton
          variant="rectangular"
          width="100%"
          height={36}
          sx={{ mt: 1 }}
        />
      </CardContent>
    </Card>
  );
});

/* ─────────────────── Memo optimisation ─────────────────── */
function propsAreEqual(prev, next) {
  const prevCats = Array.isArray(prev.subCategories)
    ? prev.subCategories.join('|')
    : '';
  const nextCats = Array.isArray(next.subCategories)
    ? next.subCategories.join('|')
    : '';
  return (
    prevCats === nextCats &&
    prev.currentProductId === next.currentProductId &&
    prev.singleVariantCode === next.singleVariantCode &&
    prev.singleCategoryCode === next.singleCategoryCode
  );
}

const TopBoughtProducts = memo(TopBoughtProductsBase, propsAreEqual);

export { TopBoughtProducts };
export default TopBoughtProducts;
