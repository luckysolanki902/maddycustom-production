// @/lib/utils/fetchutils.js

import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Unified fetchProducts function handling both 'product' and 'variant' types
export async function fetchProducts(slug, page = 1, limit = ITEMS_PER_PAGE, tagFilter = null, sortBy = 'default') {
  const apiUrl = `${BASE_URL}/api/shop/products`;
  const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: fullSlug, page, limit, tagFilter, sortBy }),
      cache: 'no-cache',
    });

    if (res.status === 404) {
      return { type: 'not-found' }; // Indicate not found without redirect
    } else if (!res.ok) {
      console.error(`Failed to fetch products. Status: ${res.status}`);
      throw new Error(`Failed to fetch data. Status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching products:', error.message);
    throw error; // Next.js will handle redirection to /error
  }
}

// Fetch details for a single product
export async function fetchProductDetails(slug) {
  const apiUrl = `${BASE_URL}/api/shop/product-details`;
  const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: fullSlug }),
      cache: 'no-cache',
    });

    if (res.status === 404) {
      return { type: 'not-found' };
    } else if (!res.ok) {
      console.error(`Failed to fetch product details. Status: ${res.status}`);
      throw new Error(`Failed to fetch product details. Status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching product details:', error.message);
    throw error; // Next.js will handle redirection to /error
  }
}

// MyOrder Page
export async function fetchOrder(orderId) {
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
      console.error(`Failed to fetch order. Status: ${res.status}`);
      throw new Error(`Failed to fetch order. Status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching order:', error.message);
    throw error; // Next.js will handle redirection to /error
  }
}

// Homepage Fetch Utilities

// Our Unique Products
export async function fetchOurUniqueProducts() {
  try {
    const res = await fetch(`${BASE_URL}/api/showcase/our-unique-products`, {
      cache: 'force-cache',
    });
    if (!res.ok) {
      console.error(`Failed to fetch our unique products. Status: ${res.status}`);
      throw new Error('Failed to fetch our unique products');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching our unique products:', error.message);
    throw error;
  }
}

// random products
export async function fetchRandomProducts(categorySlug, number) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/showcase/random-products?category=${categorySlug}&number=${number || 10}`, {
    cache: 'force-cache',
  }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch random products");
  }
  return res.json();
}


export async function fetchFeaturedproducts(categoryCode, number = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/api/showcase/featured-products?categoryCode=${categoryCode}&number=${number}`,
      {
        cache: 'force-cache',
      }
    );
    if (!res.ok) {
      console.error(`Failed to fetch featured bike wraps. Status: ${res.status}`);
      throw new Error('Failed to fetch featured bike wraps');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching featured bike wraps:', error.message);
    throw error;
  }
}


// Happy Customers
export async function fetchHappyCustomers(parentSpecificCategoryId) {
  let url = `${BASE_URL}/api/showcase/happy-customers`;
  if (parentSpecificCategoryId) {
    url += `?parentSpecificCategoryId=${parentSpecificCategoryId}`;
  } else {
    url += '?homepage=true';
  }
  try {
    const res = await fetch(url, {
      cache: 'force-cache', 
    });
    if (!res.ok) {
      console.error(`Failed to fetch happy customers. Status: ${res.status}`);
      throw new Error('Failed to fetch happy customers');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching happy customers:', error.message);
    throw error;
  }
}

// Search Categories (for CategorySearchBox)
export async function fetchSearchCategories() {
  try {
    const res = await fetch(`${BASE_URL}/api/search/search-categories`, {
      cache: 'force-cache',
      headers: {
        'Cache-Control': 'public, max-age=60, immutable',
      },
    });
    if (!res.ok) {
      console.error(`Failed to fetch search categories. Status: ${res.status}`);
      throw new Error('Failed to fetch search categories');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching search categories:', error.message);
    throw error;
  }
}
