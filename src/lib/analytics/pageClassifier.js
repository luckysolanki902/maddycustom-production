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
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.replace(/\/+$/u, '');
  }
  return trimmed;
}

function classifyShopPath(segments) {
  // Count total segments (including 'shop')
  const totalSegments = segments.length;
  
  // /shop/wraps/car-wraps/fuel-cap-wraps → 4 parts = product-list-page
  // /shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol → 5 parts = product-id-page
  
  if (totalSegments === 4) {
    return PAGE_CATEGORY.PRODUCT_LIST;
  } else if (totalSegments === 5) {
    return PAGE_CATEGORY.PRODUCT_DETAIL;
  }
  
  // Anything else (1, 2, 3, or 6+ segments) = other
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
