"use client";

import React from 'react';
import ProductsWrapper from '@/components/cards/ProductsWrapper';
import Image from 'next/image';
import styles from '@/styles/home.module.css';

const FeaturedProducts = ({ data }) => { // Accept data as props
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const { category, variants, products } = data;
    const variant = variants?.length > 0 ? variants[0] : null;

    return (
        <div>
            <div className={styles.featuredHead}>
                <Image 
                    width={940} 
                    height={256} 
                    alt='heading - featured products' 
                    src={`${baseImageUrl}/assets/icons/featuredproducts.png`} 
                />
            </div>
            <div className={styles.feature1}>
                Aesthetic
            </div>
            <ProductsWrapper
                products={products}
                variant={variant}
                category={category}
                tagFilter={null}
                sortBy="default"
            />
        </div>
    );
};

export default FeaturedProducts;
