// @/components/page-sections/products-page/ChangeVariantButton.js
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Divider, Box, Button } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/changevariantbutton.module.css';
import { useMediaQuery } from '@mui/material';

export default function ChangeVariantButton({ category }) {
    const [showPopup, setShowPopup] = useState(false);
    const [variants, setVariants] = useState([]);
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const isSmallDevice = useMediaQuery('(max-width: 600px)');
    const router = useRouter();

    useEffect(() => {
        const fetchVariants = async () => {
            try {
                const response = await fetch(`/api/features/get-variants?categoryId=${category._id}`);
                const data = await response.json();
                if (data.hasMultiple) {
                    setVariants(data.variants);
                }
            } catch (error) {
                console.error('Error fetching variants:', error);
            }
        };
        fetchVariants();
    }, [category]);

    if (variants.length < 2) return null; // Only show button if there are multiple variants

    const handleVariantClick = (slug) => {
        router.push(`/shop${slug}`);
    };

    return (
        <>
                <div
                    className={styles.bikeStyle}
                    onClick={() => setShowPopup(true)}
                >
                    Change Variant
                </div>

            <Dialog
                open={showPopup}
                fullWidth
                onClose={() => setShowPopup(false)}
                PaperProps={{
                    style: {
                        borderRadius: '20px',
                        padding: '0rem',
                        maxWidth: '800px',
                    },
                }}
            >
                <DialogContent className={styles.dialogContent}>
                    <div className={`${styles.jostFam} ${styles.maindialogHeading}`}>
                        CHOOSE
                    </div>
                    <div className={styles.categoryName}>
                        {category.name}
                    </div>
                    <Divider className={styles.divider} />
                    <Box display="flex" flexDirection="column" gap="1rem">
                        {variants.map((variant) => (
                            <Box
                                key={variant.id}
                                onClick={() => handleVariantClick(variant.pageSlug)}
                                className={styles.variantBox}
                            >
                                {variant.image && (
                                    <Image
                                        src={`${baseImageUrl}${variant.image}`}
                                        className={styles.customImg}
                                        alt={variant.name}
                                        width={120}
                                        height={50}
                                    />
                                )}
                                <Box display="flex" flexDirection="column" gap="1rem">
                                    <button
                                        variant="contained"
                                        className={styles.variantButton}
                                    >
                                        {variant.name.length > 12 && isSmallDevice
                                            ? `${variant.name.substring(0, 12)}...`
                                            : variant.name}
                                    </button>
                                    <div className={styles.variantDescription}>
                                        {variant.variantInfo}
                                    </div>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
