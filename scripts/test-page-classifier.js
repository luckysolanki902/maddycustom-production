// Test script for page classification
// Run with: node scripts/test-page-classifier.js

const testCases = [
  // Home
  { path: '/', expected: 'home' },
  
  // Product List Pages (0-3 segments after /shop)
  { path: '/shop', expected: 'product-list-page' },
  { path: '/shop/wraps', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps/window-pillar-wraps', expected: 'product-list-page' },
  
  // Product ID Pages (4+ segments after /shop)
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol', expected: 'product-id-page' },
  { path: '/shop/wraps/car-wraps/window-pillar-wraps/win-wraps', expected: 'product-id-page' },
  
  // Other pages
  { path: '/about', expected: 'other' },
  { path: '/contact-us', expected: 'other' },
  { path: '/viewcart', expected: 'other' },
  { path: '/orders', expected: 'other' },
];

function classifyPath(path) {
  if (!path || typeof path !== 'string') {
    return 'other';
  }

  const normalizedPath = path.trim();
  
  // Home page
  if (normalizedPath === '/' || normalizedPath === '') {
    return 'home';
  }

  // Split path and filter empty segments
  const segments = normalizedPath
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);

  // Not a shop path
  if (!segments[0] || segments[0] !== 'shop') {
    return 'other';
  }

  // Shop paths - count segments after 'shop'
  const segmentsAfterShop = segments.length - 1;
  
  // 0-3 segments after 'shop' = product-list-page
  // 4+ segments after 'shop' = product-id-page
  if (segmentsAfterShop <= 3) {
    return 'product-list-page';
  }
  
  return 'product-id-page';
}

console.log('Testing Page Classification Logic\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach(({ path, expected }) => {
  const result = classifyPath(path);
  const status = result === expected ? '✓ PASS' : '✗ FAIL';
  const segments = path.split('/').filter(Boolean);
  const segmentsAfterShop = segments[0] === 'shop' ? segments.length - 1 : 'N/A';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`\n${status}: ${path}`);
  console.log(`  Expected: ${expected}`);
  console.log(`  Got: ${result}`);
  console.log(`  Segments after /shop: ${segmentsAfterShop}`);
});

console.log('\n' + '='.repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('\n✓ All tests passed! 🎉');
} else {
  console.log('\n✗ Some tests failed. Please review the logic.');
  process.exit(1);
}
