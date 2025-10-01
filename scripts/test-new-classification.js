// Test the NEW classification logic
const testCases = [
  { path: '/', expected: 'home' },
  { path: '/about-us', expected: 'other' },
  { path: '/shop', expected: 'other' },
  { path: '/shop/wraps', expected: 'other' },
  { path: '/shop/wraps/car-wraps', expected: 'other' },
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps', expected: 'product-list-page' },
  { path: '/shop/wraps/car-wraps/fuel-cap-wraps/rectangle-petrol', expected: 'product-id-page' },
  { path: '/shop/a/b/c/d/e', expected: 'other' },
];

function classifyPath(path) {
  if (!path || typeof path !== 'string') {
    return 'other';
  }
  const normalizedPath = path.trim();
  if (normalizedPath === '/' || normalizedPath === '') {
    return 'home';
  }
  const segments = normalizedPath.split('/').map(s => s.trim()).filter(Boolean);
  if (!segments[0] || segments[0] !== 'shop') {
    return 'other';
  }
  const totalSegments = segments.length;
  if (totalSegments === 4) {
    return 'product-list-page';
  } else if (totalSegments === 5) {
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
