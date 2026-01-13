// app/shop/[...slug]/page.js
export const revalidate = 3600; // Revalidate every 1 hour (saves ISR costs vs 10 min)
import React from 'react';
import ProductsPage from '@/components/full-page-comps/ProductsPage';
import ProductIdPage from '@/components/full-page-comps/ProductIdPage';
import { fetchProducts } from '@/lib/utils/fetchutils';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateProductSchema } from '@/lib/metadata/json-lds';
import { notFound } from 'next/navigation';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import ProductInfoTab from '@/models/ProductInfoTab';
import connectToDatabase from '@/lib/middleware/connectToDb';

async function getProductInfoTabs(specificCategory, product, variant) {
  if (
    !specificCategory ||
    !Array.isArray(specificCategory.productInfoTabs) ||
    specificCategory.productInfoTabs.length === 0
  ) {
    return [];
  }
  await connectToDatabase();
  const tabsData = await Promise.all(
    specificCategory.productInfoTabs.map(async (tabObj) => {
      const { title, fetchSource } = tabObj;
      const query = { title }; // e.g. { title: 'Description' }
      if (fetchSource === 'Product' && product) {
        query.product = product._id;
      } else if (fetchSource === 'Variant' && variant) {
        query.specificCategoryVariant = variant._id;
      } else if (fetchSource === 'SpecCat') {
        query.specificCategory = specificCategory._id;
      } else {
        return null;
      }
      const doc = await ProductInfoTab.findOne(query).lean();
      if (!doc) {
        return null;
      }
      return {
        title: doc.title,
        content: doc.content, // EditorJS data
        images: doc.images || [],
      };
    })
  );
  return tabsData.filter(Boolean);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;
  const productData = await fetchProducts(slug, 1, ITEMS_PER_PAGE);
  if (productData.type === 'not-found') {
    return {};
  }
  return createMetadata({
    canonical: canonicalUrl,
    title:
      productData.type === 'product'
        ? productData?.product?.title
        : productData?.variant?.title,
    description:
      productData.type === 'product'
        ? (
            productData?.variant?.productDescription
              ? productData.variant.productDescription
                  .replace(/{uniqueName}/g, productData.product?.name)
                  .replace(/{fullBikename}/g, productData.variant?.name)
              : productData.variant?.description || ''
          )
        : productData.variant?.description || '',
  });
}

export default async function ShopPage({ params }) {
  const { slug } = await params;
  const initialPage = 1;
  const limit = ITEMS_PER_PAGE;
  const data = await fetchProducts(slug, initialPage, limit);

  if (data.type === 'not-found') {
    notFound();
  }

  // If it’s a variant display page => show products listing
  if (data.type === 'variant') {
    return (
      <ProductsPage
        slug={slug}
        variant={data.variant}
        products={data.products}
        category={data.specificCategory}
        initialPage={data.currentPage}
        totalPages={data.totalPages}
        uniqueTags={data.uniqueTags}
        isNewLaunch={data.isNewLaunch}
      />
    );
  }

  // If it’s an actual single “product detail” page => show ProductIdPage
  if (data.type === 'product') {
    const { product, variant, specificCategory } = data;
    const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;
    const jsonLd = generateProductSchema({
      product: { ...product, url: canonicalUrl },
    });

    // Fetch the product info tabs from DB (SSR)
    const productInfoTabs = await getProductInfoTabs(specificCategory, product, variant);

    // Merge “Description” images into product images
    let appendedImages = [...(product.images || [])];
    const descriptionTab = productInfoTabs.find((t) => t.title === 'Description');
    if (descriptionTab && Array.isArray(descriptionTab.images)) {
      appendedImages = appendedImages.concat(descriptionTab.images);
    }

    // Build a productDescription if needed
    const productDescription = variant?.productDescription
      ? variant.productDescription
          .replace(/{uniqueName}/g, product.name)
          .replace(/{fullBikename}/g, variant.name)
      : '';

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ProductIdPage
          product={product}
          variant={variant}
          category={specificCategory}
          description={productDescription}
          productInfoTabs={productInfoTabs}
          appendedImages={appendedImages}
        />
      </>
    );
  }

  // Fallback
  notFound();
}
