// Test the NEW classification logic
const testCases = [
  { path: '/', expected: 'home' },
  { path: '/about-us', expected: 'other' },
  { path: '/shop', expected: 'other' },
  { path: '/shop/wraps', expected: 'other' },
  { path: '/shop/wraps/car-wraps', expected: 'other' },
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps', expected: 'other' },
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps/big-cat', expected: 'product-id-page' },
  { path: '/shop/a/b/c/d/e', expected: 'product-id-page' },
  { path: '/shop/a/b/c/d?sort=asc', expected: 'product-list-page' },
  { path: '/shop/a/b/c/d/e?variant=blue', expected: 'product-id-page' },
  { path: '/wraps/car-wraps/window-pillar-wraps/win-wraps', expected: 'product-list-page' },
  { path: '/wraps/car-wraps/window-pillar-wraps/win-wraps/bunny', expected: 'product-id-page' },
  { path: 'wraps/car-wraps/window-pillar-wraps/win-wraps/bunny', expected: 'product-id-page' },
];

function classifyPath(path) {
  if (!path || typeof path !== 'string') {
    return 'other';
  }

  const trimmed = path.trim();
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? '';
  let normalized = withoutQuery.length ? withoutQuery : '/';

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  normalized = normalized.replace(/\/+/g, '/');
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/u, '');
  }

  if (normalized === '/' || normalized === '') {
    return 'home';
  }

  const segments = normalized.split('/').map((segment) => segment.trim()).filter(Boolean);

  if (!segments.length) {
    return 'home';
  }

  if (segments[0] !== 'shop' && segments.length >= 4) {
    segments.unshift('shop');
  }

  if (segments[0] !== 'shop') {
    return 'other';
  }

  const segmentsAfterShop = segments.length - 1;

  if (segmentsAfterShop === 4) {
    return 'product-list-page';
  }

  if (segmentsAfterShop === 5) {
    return 'product-id-page';
  }

  return 'other';
}

console.log('Testing NEW classification logic:\n');
testCases.forEach(test => {
  const result = classifyPath(test.path);
  const status = result === test.expected ? ' PASS' : ' FAIL';
  console.log(`${status} | ${test.path}`);
  console.log(`  Expected: ${test.expected}, Got: ${result}`);
});
