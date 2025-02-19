"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './styles/productslider.module.css';

const ProductSlider = ({ slides }) => { // Accept slides as props
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    return (
        <div className={styles.main}>
            <div className={styles.slider}>
                {/* Map over slides array to render each slide */}
                {slides.map((slide, index) => (
                    <div key={index} className={styles.slide}>
                        <Link href={`/shop/${slide.pageSlug}`}>
                            <Image
                                className={styles.image}
                                src={`${baseImageUrl}${slide.images[0].startsWith('/') ? slide.images[0] : '/' + slide.images[0]}`} // Use the first image from the product
                                width={500}
                                height={500}
                                alt={slide.name}
                            />
                            <div className={styles.details}>
                                <div className={styles.name}>{slide.name}</div>
                                <p className={styles.para}>
                                    <span className={styles.rupee}>₹</span>
                                    <span className={styles.price}>{slide.price}</span>
                                </p>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProductSlider;
