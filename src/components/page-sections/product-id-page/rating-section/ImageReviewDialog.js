// src/components/ImageReviewDialog.js

"use client";

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Box,
    Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Image from 'next/image';
import ReviewCard from './ReviewCard'; // Adjust the import path as needed
import styles from './styles/imageReviewDialog.module.css';
import { constReviews } from '../constReviews'; // Import constReviews directly

const ImageReviewDialog = ({ open, handleClose, initialReview, reviews }) => {
    const [selectedReview, setSelectedReview] = useState(initialReview);
    const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    // Update selectedReview when initialReview changes
    useEffect(() => {
        setSelectedReview(initialReview);
    }, [initialReview]);

    const handleThumbnailClick = (review) => {
        setSelectedReview(review);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="md"
            aria-labelledby="image-review-dialog-title"
            PaperProps={{
                style: {
                    borderRadius: '0.5rem'
                },
            }}
        >
            <DialogContent
                dividers
                sx={{ backgroundColor: 'rgb(0, 0, 0)', padding: 0 }}
            >
                {/* Close Button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
                    <IconButton
                        aria-label="close"
                        onClick={handleClose}
                        className={styles.closeButton}
                        sx={{ color: '#fff' }} // Ensure the close button is visible on dark background
                    >
                        <CloseIcon sx={{ fontSize: 30 }} />
                    </IconButton>
                </Box>

                {/* Main Content: Large Image and Review */}
                <Box className={styles.mainContent}>
                    <Box className={styles.imageContainer}>
                        <Image
                            src={`${imageBaseUrl}${selectedReview?.images[0]?.startsWith('/') ? selectedReview.images[0] : '/' + selectedReview.images[0]}`}
                            alt={`Review photo by ${selectedReview.name}`}
                            width={800}
                            height={800}
                            className={styles.largeImage}
                            style={{ borderRadius: '8px' }}
                        />
                    </Box>
                </Box>

                {/* Thumbnail Scroller */}
                <Box className={styles.thumbnailScroller}>
                    {reviews
                        .filter((review) => review.images.length !== 0) // Ensure only reviews with images are shown
                        .map((review) => (
                            <Box
                                key={review.id}
                                className={`${styles.thumbnail} ${review.id === selectedReview.id ? styles.activeThumbnail : ''
                                    }`}
                                onClick={() => handleThumbnailClick(review)}
                            >
                                <Image
                                    src={`${imageBaseUrl}${ review.images[0].startsWith('/') ? review.images[0] : '/' + review.images[0]}`}
                                    alt={`Thumbnail of review by ${review.name}`}
                                    width={100}
                                    height={100}
                                    className={styles.thumbnailImage}
                                    style={{ borderRadius: '4px' }}
                                    objectFit="cover"
                                />
                            </Box>
                        ))}
                </Box>

                {/* Review Card */}
                <Box className={styles.reviewContainer}>
                    <ReviewCard
                        rating={selectedReview.rating}
                        name={selectedReview.name}
                        comment={selectedReview.comment}
                        date={selectedReview.date}
                        fullWidth={true}
                    />
                </Box>
            </DialogContent>
        </Dialog>
    );
};



export default ImageReviewDialog;
