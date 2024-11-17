"use client"
// @/app/components/HelmetSlider.js

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './styles/helmetslider.module.css';

const HelmetSlider = () => {
    const [helmetSlides, setHelmetSlides] = useState([]);
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    useEffect(() => {
        const fetchHelmetSlides = async () => {
            try {
                const response = await fetch('/api/showcase/helmet-slider');
                const data = await response.json();
                setHelmetSlides(data);
            } catch (error) {
                console.error("Error fetching helmet slides:", error);
            }
        };
        fetchHelmetSlides();
    }, []);

    return (
        <div className={styles.main}>
            <div className={styles.slider}>
                {/* Map over helmetSlides array to render each slide */}
                {helmetSlides.map((slide, index) => (
                    <div key={index} className={styles.slide}>
                        <Link href={`/shop/accessories/safety/graphic-helmets/helmet-store`}>
                        {/* <Link href={`/shop${slide.pageSlug}`}> */}
                            <Image
                                className={styles.image}
                                src={`${baseImageUrl}${slide.images[0]}`} // Use the first image from the product
                                width={1500 / 3}
                                height={1500 / 3}
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

export default HelmetSlider;
