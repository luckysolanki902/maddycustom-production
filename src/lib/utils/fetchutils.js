// @/lib/utils/fetchutils.js

import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Fetch products based on slug, pagination, filtering, and sorting.
 * Uses Next.js revalidation to cache responses for 60 seconds.
 */
export async function fetchProducts(slug, page = 1, limit = ITEMS_PER_PAGE, tagFilter = null, sortBy = 'default') {
  const apiUrl = `${BASE_URL}/api/shop/products`;
  const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: fullSlug, page, limit, tagFilter, sortBy }),
      // Use revalidation to balance cache storage and data freshness
      next: { revalidate: 600 },
    });

    if (res.status === 404) {
      return { type: 'not-found' };
    } else if (!res.ok) {
      console.error(`Failed to fetch products. Status: ${res.status}`);
      throw new Error(`Failed to fetch data. Status: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching products:', error.message);
    throw error;
  }
}

/**
 * Fetch details for a single product.
 * Data is revalidated every 60 seconds.
 */
export async function fetchProductDetails(slug) {
  const apiUrl = `${BASE_URL}/api/shop/product-details`;
  const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: fullSlug }),
      next: { revalidate: 600 },
    });

    if (res.status === 404) {
      return { type: 'not-found' };
    } else if (!res.ok) {
      console.error(`Failed to fetch product details. Status: ${res.status}`);
      throw new Error(`Failed to fetch product details. Status: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching product details:', error.message);
    throw error;
  }
}

/**
 * Fetch an order by ID.
 * Response is cached and revalidated every 60 seconds.
 */
export async function fetchOrder(orderId) {
  const apiUrl = `${BASE_URL}/api/order/${orderId}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    });

    if (res.status === 404) {
      return { type: 'not-found' };
    } else if (!res.ok) {
      console.error(`Failed to fetch order. Status: ${res.status}`);
      throw new Error(`Failed to fetch order. Status: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching order:', error.message);
    throw error;
  }
}

/**
 * Fetch our unique products for the homepage.
 * Uses a 60-second revalidation strategy.
 */
export async function fetchOurUniqueProducts() {
  try {
    const res = await fetch(`${BASE_URL}/api/showcase/our-unique-products`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`Failed to fetch our unique products. Status: ${res.status}`);
      throw new Error('Failed to fetch our unique products');
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching our unique products:', error.message);
    throw error;
  }
}

/**
 * Fetch random products from a specific category.
 * Revalidates the cached response every 60 seconds.
 */
export async function fetchRandomProducts(categorySlug, number) {
  const res = await fetch(
    `${BASE_URL}/api/showcase/random-products?category=${categorySlug}&number=${number || 10}`,
    {
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch random products");
  }
  return await res.json();
}

/**
 * Fetch featured products based on a category code.
 * Data is cached and revalidated every 60 seconds.
 */
export async function fetchFeaturedproducts(categoryCode, number = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/api/showcase/featured-products?categoryCode=${categoryCode}&number=${number}`,
      {
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) {
      console.error(`Failed to fetch featured products. Status: ${res.status}`);
      throw new Error('Failed to fetch featured products');
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching featured products:', error.message);
    throw error;
  }
}

/**
 * Fetch happy customers.
 * If a parent-specific category ID is provided, it is appended as a query parameter;
 * otherwise, it fetches customers for the homepage.
 * The response is revalidated every 60 seconds.
 */
export async function fetchHappyCustomers(parentSpecificCategoryId) {
  let url = `${BASE_URL}/api/showcase/happy-customers`;
  if (parentSpecificCategoryId) {
    url += `?parentSpecificCategoryId=${parentSpecificCategoryId}`;
  } else {
    url += '?homepage=true';
  }
  try {
    const res = await fetch(url, {
      next: { revalidate: 3060 },
    });
    if (!res.ok) {
      console.error(`Failed to fetch happy customers. Status: ${res.status}`);
      throw new Error('Failed to fetch happy customers');
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching happy customers:', error.message);
    throw error;
  }
}

/**
 * Fetch search categories for the CategorySearchBox.
 * This function uses both the Next.js revalidate option (60 seconds) and
 * custom cache control headers for additional caching hints.
 */
export async function fetchSearchCategories() {
  try {
    const res = await fetch(`${BASE_URL}/api/search/search-categories`, {
      next: { revalidate: 300 },
      headers: {
        'Cache-Control': 'public, max-age=60, immutable',
      },
    });
    if (!res.ok) {
      console.error(`Failed to fetch search categories. Status: ${res.status}`);
      throw new Error('Failed to fetch search categories');
    }
    return await res.json();
  } catch (error) {
    console.error('Error fetching search categories:', error.message);
    throw error;
  }
}
