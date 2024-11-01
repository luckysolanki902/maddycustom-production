"use client"
import React from 'react';
import styles from './styles/orderspecifications.module.css';
import Image from 'next/image';

const OrderSpecifications = ({ features = [] }) => {
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    return (
        <div className={styles.main}>
            {features.map((feature, index) => (
                <div key={index} className={styles.item}>
                    <Image 
                        src={`${imageBaseUrl}${feature.imageUrl}`} 
                        width={500} 
                        height={500} 
                        alt={feature.name} 
                    />
                    <div className={styles.word}>{feature.name}</div>
                </div>
            ))}
        </div>
    );
};

export default OrderSpecifications;
