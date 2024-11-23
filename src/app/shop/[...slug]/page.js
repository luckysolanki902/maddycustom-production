// app/shop/[...slug]/page.js
import React from 'react';
import ProductsPage from '@/components/full-page-comps/ProductsPage';
import ProductIdPage from '@/components/full-page-comps/ProductIdPage';
import { fetchProducts } from '@/lib/utils/fetchutils';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateProductSchema } from '@/lib/metadata/json-lds';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;

  // Fetch product data for SEO fields
  const productData = await fetchProducts(slug);

  return createMetadata({
    canonical: canonicalUrl,
    title: `${productData.type === 'product' ? productData?.product?.title : productData?.variant?.title}`,
    description: productData.type === 'product'
    ? productData.variant.productDescription
        .replace(/{uniqueName}/g, productData.product?.name)
        .replace(/{fullBikename}/g, productData.variant?.name)
    : productData.variant?.description,
  });
}

export default async function ShopPage({ params }) {
  const { slug } = await params;
  const data = await fetchProducts(slug);

  const productDescription =
    data.type === 'product'
      ? data.variant.productDescription
          .replace(/{uniqueName}/g, data.product.name)
          .replace(/{fullBikename}/g, data.variant.name)
      : data.variant?.description;

  if (data.type === 'variant') {
    return (
      <ProductsPage
        variant={data.variant}
        products={data.products}
        category={data.specificCategory}
      />
    );
  } else if (data.type === 'product') {
    const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;
    
    // Generate JSON-LD structured data
    const jsonLd = generateProductSchema({
      product: {
        ...data.product,
        url: canonicalUrl,
      },
    });
 

    return (
      <section>
        {/* Inject JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ProductIdPage
          product={data.product}
          variant={data.variant}
          category={data.specificCategory}
          description={productDescription}
        />
      </section>
    );
  }
  else if (data.type === 'not-found') {
    notFound();
  }
}
