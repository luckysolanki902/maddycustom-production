'use client';

import React from 'react';
import Image from 'next/image';
import styles from './styles/WhyMaddy.module.css';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';

const cardData = [
  {
    title: 'Shipping',
    image: `${baseImageUrl}/assets/icons/shipping.png`,
    details: ['Free shipping', '3 Attempts', 'Tracking updates'],
  },
  {
    title: 'Payment Model',
    image: `${baseImageUrl}/assets/icons/shipping.png`,
    details: ['Secure payments', 'Multiple options', 'Easy refunds'],
  },
  {
    title: 'Support',
    image: `${baseImageUrl}/assets/icons/shipping.png`,
    details: ['24/7 Help', 'Dedicated agent', 'Fast response'],
  },
  {
    title: 'Quality Check',
    image: `${baseImageUrl}/assets/icons/shipping.png`,
    details: ['Premium materials', 'Double inspection', 'Warranty included'],
  },
  // add more cards here as needed
];

export default function WhyMaddy() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Why Maddy Custom ?</h2>

      <div className={styles.cardRow}>
        {cardData.map((card, i) => (
          <div className={styles.card} key={i}>
            {/* icon floats above the box */}
            <div className={styles.imageWrapper}>
              <Image
                src={card.image}
                alt={card.title}
                width={120}
                height={80}
                priority
              />
            </div>

            {/* dark content box */}
            <div className={styles.contentBox}>
              <h3 className={styles.title}>{card.title}</h3>
              {card.details.map((line, j) => (
                <p className={styles.text} key={j}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

