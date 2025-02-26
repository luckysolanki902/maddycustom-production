"use client"
import React from 'react';
import styles from './styles/orderspecifications.module.css';
import Image from 'next/image';

const OrderSpecifications = ({ features = [], borderUrl, justContStart }) => {
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const newFeatures = [
        {
            name: "7 Days Replacement",
            imageUrl: "/assets/icons/7-day-replacement1.png"
        },
        {
            name: "Free Shipping",
            imageUrl: "/assets/icons/free-shipping1.png"
        },
        {
            name: "Partial COD",
            imageUrl: "/assets/icons/partial-cod1.png"
        }
    ]
    
    return (
        <div className={`${styles.main} ${justContStart ? styles.justContStart : ''}`}>
            {newFeatures.map((feature, index) => (
                <div 
                    key={index} 
                    className={styles.item} 
                    style={{ borderImage: `url(${borderUrl}) 30 round` }}
                >
                    <Image 
                        src={`${imageBaseUrl}${feature.imageUrl.startsWith('/') ? feature.imageUrl : '/' + feature.imageUrl}`} 
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
