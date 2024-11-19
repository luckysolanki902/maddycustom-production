// @/app/components/page-sections/homepage/FeaturedFullBikeWraps.js

"use client";
import React, { useEffect, useState } from 'react';
import ProductsWrapper from '@/components/cards/ProductsWrapper';
import Image from 'next/image';
import styles from '@/styles/home.module.css'

const FeaturedFullBikeWraps = () => {
    const [products, setProducts] = useState([]);
    const [category, setCategory] = useState(null);
    const [variant, setVariant] = useState(null);
    const [loading, setLoading] = useState(true);
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    useEffect(() => {
        const fetchFeaturedFullBikeWraps = async () => {
            try {
                const response = await fetch('/api/showcase/featured-full-bike-wraps');
                const data = await response.json();

                setCategory(data.category);
                setVariant(data?.variants?.length > 0 ? data.variants[0] : null);
                setProducts(data.products);
            } catch (error) {
                console.error("Error fetching featured bike wraps:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFeaturedFullBikeWraps();
    }, []);

    if (loading) return null;

    return (
        <div>
            <div className={styles.featuredHead}>
                <Image width={940} height={256} alt='heading - featured products' src={`${baseImageUrl}/assets/icons/featuredproducts.png`}></Image>
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

export default FeaturedFullBikeWraps;
