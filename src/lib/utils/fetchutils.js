// @/lib/utils/fetchutils.js

export async function fetchProducts(slug) {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiUrl = `${BASE_URL}/api/shop/products`;
    const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;
  
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: fullSlug }),
        cache: 'no-cache',
      });
  
      if (res.status === 404) {
        return { type: 'not-found' }; // Indicate not found without redirect
      } else if (!res.ok) {
        throw new Error(`Failed to fetch data. Status: ${res.status}`);
      }
  
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error; // Next.js will handle redirection to /error
    }
  }
  
  export async function fetchOrder(orderId) {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiUrl = `${BASE_URL}/api/order/${orderId}`;
  
    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });
  
      if (res.status === 404) {
        return { type: 'not-found' }; // Indicate not found without redirect
      } else if (!res.ok) {
        throw new Error(`Failed to fetch order. Status: ${res.status}`);
      }
  
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error; // Next.js will handle redirection to /error
    }
  }