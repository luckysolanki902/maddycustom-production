// pages/ProductsPage.js
"use client";
import Image from 'next/image';
import React, { useState } from 'react';
import styles from './styles/products.module.css';
import { useMediaQuery } from '@mui/material';
import ProductsWrapper from '../cards/ProductsWrapper';
import Tags from '../page-sections/products-page/Tags';

export default function ProductsPage({ variant, products }) {
  // Constants
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // State for tag filter and sort filter
  const [tagFilter, setTagFilter] = useState(null);
  const [sortBy, setSortBy] = useState('default');

  // Get the unique tags from the products
  const allTags = [
    ...new Set(
      products.flatMap((product) =>
        product.mainTags.map((tag) => tag.trim())
      )
    ),
  ];


  return (
    <div>
      <header>
        <div className={styles.headContainer}>
          <div className={styles.headingFlex}>
            <h1 className={styles.bikeHeading}>{variant.name}</h1>
            {variant?.subtitles.length > 0 && variant?.subtitles[0] && (
              variant.variantCode === 'hel' ?
                <>
                  <h2 className={styles.helmetTagline}>&quot;Best designed helmets of india <br /> with safety of&quot;</h2>
                  <Image className={styles.studds} src={`${baseImageUrl}${variant?.availableBrands[0]?.brandLogo}`} width={1103 / 5} height={394 / 5} alt={'studds'}></Image></>
                :
                <h2 className={styles.belowMainHeading} >{variant?.subtitles[0]}</h2>

            )}

          </div>
        </div>
      </header>

      <Tags setTagFilter={setTagFilter} tags={allTags} />
      {/* <SortBy setSortBy={setSortBy} /> */}

      <ProductsWrapper
        variant={variant}
        products={products}
        tagFilter={tagFilter}
        sortBy={sortBy}
      />
    </div>
  );
}
