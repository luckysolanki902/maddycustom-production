// app/shop/[...slug]/page.js
import React from 'react';
import { notFound } from 'next/navigation';
import ProductsPage from '@/components/full-page-comps/ProductsPage';
import ProductIdPage from '@/components/full-page-comps/ProductIdPage';

export default async function ShopPage({ params }) {
  const { slug } = await params;
  const fullSlug = Array.isArray(slug) ? slug.join('/') : slug;
  const BASE_URL = 'http://localhost:3000';
  const apiUrl = `${BASE_URL}/api/shop/products`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: fullSlug }),
      cache: 'no-cache',
    });

    if (!res.ok) {
      if (res.status === 404) {
        notFound();
      }
      throw new Error(`Failed to fetch data. Status: ${res.status}`);
    }

    const data = await res.json();

    // Render ProductsPage if the response is a variant with products
    if (data.type === 'variant') {
      return <ProductsPage variant={data.variant} products={data.products} />;
    }

    // Render ProductIdPage if the response is a single product
    if (data.type === 'product') {
      return <ProductIdPage product={data.product} />;
    }

    // If no valid data type is found, render not found
    notFound();

  } catch (error) {
    console.error('Error fetching data:', error);
    return (
      <div style={styles.errorContainer}>
        <h1>Something went wrong</h1>
        <p>We couldn&apos;t load the page. Please try again later.</p>
      </div>
    );
  }
}

const styles = {
  errorContainer: {
    padding: '20px',
    textAlign: 'center',
  },
};
