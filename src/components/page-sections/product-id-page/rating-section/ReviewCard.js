// src/components/page-sections/product-id-page/rating-section/ReviewCard.js
import React from 'react';
import styles from './styles/reviewcard.module.css';
import { Star, StarBorder } from '@mui/icons-material';
import { Avatar } from '@mui/material';
import Image from 'next/image';

const ReviewCard = ({ rating = 4,status='approved', name = 'Maddy Singh', comment = 'Awesome', date = '16/08/2025', fullWidth=false }) => {
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  return (
    <div className={`${styles.container} ${fullWidth ? styles.fullwidthclass : ''}`}>
      {/* Rating and Date Section */}
      <div className={styles.ratingAndDateCont}>
        <div className={styles.rating}>
          {[...Array(5)].map((_, index) =>
            index < rating ? (
              <Star key={index} style={{ color: '#00c853' }} className={styles.filledStar} />
            ) : (
              <StarBorder key={index} className={styles.emptyStar} />
            )
          )}
        </div>
        <span className={styles.date}>{date}</span>
      </div>

      {/* User Info */}
      <div className={styles.userInfo}>
        {/* <Avatar className={styles.avatar} /> */}
        <Image className={styles.avatar} src={`${imageBaseUrl}/assets/icons/rounded_corner_default_avtar.png`} alt="avatar" width={50} height={50}></Image>
        <span className={styles.name}>{name}</span>
      </div>

      {/* Comment Section */}
      <p className={styles.comment}>{comment}</p>
    </div>
  );
};

export default ReviewCard;
