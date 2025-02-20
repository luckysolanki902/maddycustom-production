// app/shop/[...slug]/page.js

import React from 'react';
import ProductsPage from '@/components/full-page-comps/ProductsPage';
import ProductIdPage from '@/components/full-page-comps/ProductIdPage';
import { fetchProducts } from '@/lib/utils/fetchutils';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { generateProductSchema } from '@/lib/metadata/json-lds';
import { notFound } from 'next/navigation';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import ContactUs from '@/components/layouts/ContactUs';

// 1) IMPORT YOUR ProductInfoTab MONGOOSE MODEL:
import ProductInfoTab from '@/models/ProductInfoTab';
import connectToDatabase from '@/lib/middleware/connectToDb';

// HELPER to fetch the product info tabs from DB
async function getProductInfoTabs(specificCategory, product, variant) {
  if (
    !specificCategory ||
    !Array.isArray(specificCategory.productInfoTabs) ||
    specificCategory.productInfoTabs.length === 0
  ) {
    return [];
  }

  // For each tab config in the category, we’ll fetch the matching ProductInfoTab document:
  const tabsData = await Promise.all(
    specificCategory.productInfoTabs.map(async (tabObj) => {
      const { title, fetchSource } = tabObj;

      const query = { title }; // e.g. { title: 'Description' or 'How to Apply' }
      if (fetchSource === 'Product' && product) {
        query.product = product._id;
      } else if (fetchSource === 'Variant' && variant) {
        query.specificCategoryVariant = variant._id;
      } else if (fetchSource === 'SpecCat') {
        query.specificCategory = specificCategory._id;
      } else {
        // If we cannot match a resource, or something’s missing, skip.
        return null;
      }
      console.log(query)
      await connectToDatabase();

      const doc = await ProductInfoTab.findOne(query).lean();
      if (!doc) {
        return null;
      }

      console.log("doc",doc)

      // Return the data we need for rendering.
      return {
        title: doc.title,
        content: doc.content, // EditorJS data
        images: doc.images || [],
      };
    })
  );

  return tabsData.filter(Boolean); // remove nulls
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;

  // Fetch product data for SEO fields
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
        ? productData.variant.productDescription
            .replace(/{uniqueName}/g, productData.product?.name)
            .replace(/{fullBikename}/g, productData.variant?.name)
        : productData.variant?.description,
  });
}

export default async function ShopPage({ params }) {
  const { slug } = await params;
  const initialPage = 1;
  const limit = ITEMS_PER_PAGE;

  // Use your existing fetch utility
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
      />
    );
  }

  // If it’s an actual single “product detail” page => show ProductIdPage
  if (data.type === 'product') {
    const { product, variant, specificCategory } = data;

    // Generate JSON-LD structured data
    const canonicalUrl = `https://www.maddycustom.com/shop/${slug.join('/')}`;
    const jsonLd = generateProductSchema({
      product: { ...product, url: canonicalUrl },
    });

    // 2) FETCH the product info tabs from DB (SSR)
    const productInfoTabs = await getProductInfoTabs(specificCategory, product, variant);

    // 3) MERGE “Description” images into product images
    let appendedImages = [...(product.images || [])];
    const descriptionTab = productInfoTabs.find((t) => t.title === 'Description');
    if (descriptionTab && Array.isArray(descriptionTab.images)) {
      appendedImages = appendedImages.concat(descriptionTab.images);
    }

    // 4) Build a productDescription if you still want it:
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
          // Pass SSR-fetched tabs:
          productInfoTabs={productInfoTabs}
          // Pass the appended images array for the gallery:
          appendedImages={appendedImages}
        />
      </>
    );
  }
}
