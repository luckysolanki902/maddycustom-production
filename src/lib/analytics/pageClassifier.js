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
  // segments[0] is 'shop', so check segments after 'shop'
  const segmentsAfterShop = segments.length - 1;
  
  // /shop → product-list-page (0 segments after shop)
  // /shop/wraps → product-list-page (1 segment after shop)
  // /shop/wraps/car-wraps → product-list-page (2 segments after shop)
  // /shop/wraps/car-wraps/fuel-cap-wraps → product-list-page (3 segments after shop)
  // /shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol → product-id-page (4 segments after shop)
  
  if (segmentsAfterShop <= 3) {
    return PAGE_CATEGORY.PRODUCT_LIST;
  }
  return PAGE_CATEGORY.PRODUCT_DETAIL;
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
