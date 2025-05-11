'use client';

import React from 'react';
import Image from 'next/image';
import styles from './styles/WhyMaddy.module.css';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';

const cardData = [
  {
    title: 'Personal Touch',
    image: `${baseImageUrl}/assets/icons/whymaddy-premiumtouch.png`,
    details: [
      'Unique customization',
      'Reflects your personality',
      'Tailored wrap designs',
    ],
  },
  {
    title: 'Premium Build',
    image: `${baseImageUrl}/assets/icons/whymaddy-premiumbuild.png`,
    details: [
      'High-quality materials',
      'Water-resistant wraps',
      'Long-lasting durability',
    ],
  },
  {
    title: 'Value Choice',
    image: `${baseImageUrl}/assets/icons/whymaddy-valuechoice.png`,
    details: [
      'Affordable styling option',
      'Cost-effective ',
      'Stylish look on a budget',
    ],
  },
  {
    title: 'Seamless Fit',
    image: `${baseImageUrl}/assets/icons/whymaddy-seamlessfit.png`,
    details: [
      'Precision fit',
      'Smooth look',
      'Factory finish',
    ],
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

