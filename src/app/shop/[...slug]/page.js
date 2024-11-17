// app/shop/[...slug]/page.js

import React from 'react';
import ProductsPage from '@/components/full-page-comps/ProductsPage';
import ProductIdPage from '@/components/full-page-comps/ProductIdPage';
import { fetchProducts } from '@/lib/utils/fetchutils';
import { redirect } from 'next/navigation';

export default async function ShopPage({ params }) {
  const { slug } = await params;

  const data = await fetchProducts(slug);
  // Render ProductsPage if the response is a variant with products
  if (data.type === 'variant') {
    return (
      <ProductsPage
        variant={data.variant}
        products={data.products}
        category={data.specificCategory} // Pass specificCategory
      />
    );
  }

  // Render ProductIdPage if the response is a single product along with its variant
  else if (data.type === 'product') {
    return (
      <ProductIdPage
        product={data.product}
        variant={data.variant}
        category={data.specificCategory} // Pass specificCategory
      />
    );
  }

  // Redirect to not found if no data is available
  // redirect('/not-found');
}
