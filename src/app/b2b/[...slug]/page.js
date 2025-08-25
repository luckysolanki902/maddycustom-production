import React from 'react';
import { fetchProducts } from '@/lib/utils/fetchutils';
import ProductCardB2B from '@/components/cards/ProductCardB2B';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import B2BPagination from '@/components/page-sections/products-page/B2BPagination';
import ChangeVariantButton from '@/components/page-sections/products-page/ChangeVariantButton';

export const revalidate = 300;

export default async function B2BVariantProductsPage({ params, searchParams }) {
  // params & searchParams are async in Next 15 when using dynamic APIs
  const { slug } = await params; // slug is array
  const sp = await searchParams;
  const pageParam = parseInt(sp?.page || '1', 10) || 1;
  const data = await fetchProducts(slug, pageParam, ITEMS_PER_PAGE);
  if (data.type === 'not-found') return notFound();
  if (data.type === 'product') {
    // In B2B mode we don't show single product page; redirect to variant root
    return notFound();
  }
  const { products, variant, totalPages, currentPage, totalItems, specificCategory } = data;
  return (
    <main style={{ padding: '32px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#2d2d2d', margin: 0 }}>{variant.title}</h1>
          <span style={{ fontSize: 12, color: '#777' }}>{totalItems || 0} products • Page {currentPage} of {totalPages || 1}</span>
        </div>
        <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Enter required quantity for each product below.</p>
      </div>
      {specificCategory && (
        <div style={{ marginBottom: 28 }}>
          <ChangeVariantButton category={specificCategory} mode="b2b" />
        </div>
      )}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
        {products.map(p => <ProductCardB2B key={p._id} product={p} />)}
      </div>
  {totalPages > 1 && <B2BPagination currentPage={currentPage} totalPages={totalPages} slugArray={slug} />}
    </main>
  );
}
