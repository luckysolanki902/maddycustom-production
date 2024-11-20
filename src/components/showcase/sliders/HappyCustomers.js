'use client';

import React from 'react';
import Image from 'next/image';
import styles from './styles/happycustomers.module.css';

export default function HappyCustomers({ data, noShadow, noHeading, headingText = 'Happy Customers' }) {
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const happyCustomers = data?.happyCustomers || [];

    const getFirstLetter = (name) => (name ? name[0] : '');

    if (!happyCustomers.length) return null;

    return (
        <div className={`${styles.main} ${!noShadow && styles.shadow}`}>
            <div className={styles.pastOrdersMain}>
                {!noHeading && <div className={styles.pastOrdersH}>{headingText}</div>}
            </div>
            <div className={styles.slider}>
                {happyCustomers.map((customer, index) => (
                    <div className={styles.slide} key={index}>
                        <Image
                            src={`${baseImageUrl}/${customer.photo}`.trim()}
                            alt={`${customer.name}'s photo`}
                            width={500}
                            height={500}
                            className={styles.image}
                        />
                        <div className={styles.details}>
                            <div className={styles.circle}>{getFirstLetter(customer.name)}</div>
                            <span className={styles.name}>{customer.name}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
