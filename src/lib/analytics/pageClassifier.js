const PAGE_CATEGORY = {
  HOME: 'home',
  PRODUCT_LIST: 'product-list-page',
  PRODUCT_DETAIL: 'product-id-page',
  OTHER: 'other',
};

export const PAGE_CATEGORY_VALUES = ['home', 'product-list-page', 'product-id-page', 'other'];

function normalizePath(pathname = '/') {
  if (typeof pathname !== 'string' || pathname.length === 0) {
    return '/';
  }

  const trimmed = pathname.trim();
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? '';
  let normalized = withoutQuery.length ? withoutQuery : '/';

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/u, '');
  }

  if (!normalized.length) {
    return '/';
  }

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return '/';
  }

  if (segments[0] === 'shop') {
    return normalized;
  }

  if (segments.length >= 4) {
    return `/shop/${segments.join('/')}`;
  }

  return normalized;
}

function classifyShopPath(segments) {
  // Count segments AFTER 'shop'
  const segmentsAfterShop = segments.length - 1;

  if (segmentsAfterShop === 4) {
    return PAGE_CATEGORY.PRODUCT_LIST;
  }

  if (segmentsAfterShop === 5) {
    return PAGE_CATEGORY.PRODUCT_DETAIL;
  }

  return PAGE_CATEGORY.OTHER;
}

export function classifyPage(pathname = '/') {
  const normalizedPath = normalizePath(pathname);
  const isRoot = normalizedPath === '/';

  if (isRoot) {
    return {
      pageName: PAGE_CATEGORY.HOME,
      pageCategory: PAGE_CATEGORY.HOME,
      path: '/',
      segments: [],
    };
  }

  const segments = normalizedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments[0] === 'shop') {
    const pageCategory = classifyShopPath(segments);
    return {
      pageName: pageCategory,
      pageCategory,
      path: normalizedPath,
      segments,
    };
  }

  return {
    pageName: PAGE_CATEGORY.OTHER,
    pageCategory: PAGE_CATEGORY.OTHER,
    path: normalizedPath,
    segments,
  };
}

export const PAGE_CATEGORY_ENUM = Object.freeze({ ...PAGE_CATEGORY });

export default classifyPage;
