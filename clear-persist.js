// Run this in browser console to clear old persist data
console.log('Clearing old Redux persist data...');

// Clear all redux-persist keys
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('persist:root')) {
    console.log('Removing:', key);
    localStorage.removeItem(key);
  }
});

console.log('Done! Please refresh the page.');
