// src/components/CustomerPhotos.js

"use client";

import React, { useState } from 'react';
import styles from './styles/customerphotos.module.css';
import { Typography } from '@mui/material';
import Image from 'next/image';
import { constReviews } from '../constReviews';
import ImageReviewDialog from './ImageReviewDialog'; // Adjust the import path as needed
import { Reviews } from '@mui/icons-material';

const CustomerPhotos = ({reviews}) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [currentReview, setCurrentReview] = useState(null);
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    const handleImageClick = (review) => {
        setCurrentReview(review);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setCurrentReview(null);
    };
    console.log(reviews,"sdgdg")

    // Filter reviews that have an image
    const reviewsWithImages = reviews.filter((review) => review.images.length!==0);
    console.log(reviewsWithImages)
    console.log(`${imageBaseUrl}${reviews.images}`)

    return (
        <div className={styles.mainContainer}>
            <div className={styles.container}>
                <h3 className={styles.mainHeading}>Customer Photos</h3>
                {reviewsWithImages.length === 0 ? (
                    <Typography
                        variant="body1"
                        color="textSecondary"
                        align="center"
                        gutterBottom
                    >
                        No photos yet
                    </Typography>
                ) : (
                    <div className={styles.imageGrid}>
                        {reviewsWithImages.map((review) => (
                            
                            <div
                                key={review.id}
                                className={styles.reviewImageContainer}
                                onClick={() => handleImageClick(review)}
                            >
                            {console.log(`${imageBaseUrl}/${review.images}`)}
                                <Image
                                    width={200}
                                    height={200}
                                    className={styles.reviewImage}
                                    src={`${imageBaseUrl}/${review.images}`}
                                    alt={`Review photo by ${review.name}`}
                                    title={`Review photo by ${review.name}`}
                                    style={{ borderRadius: '8px' }}
                                    objectFit="cover"
                                />
                            </div>
                        ))}
                    </div>
                )}
                {currentReview && (
                    <ImageReviewDialog
                        open={dialogOpen}
                        handleClose={handleCloseDialog}
                        initialReview={currentReview}
                        reviews={reviewsWithImages}
                    />
                )}
            </div>
        </div>
    );
};

export default CustomerPhotos;
