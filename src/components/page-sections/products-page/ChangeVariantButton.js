// components/page-sections/products-page/ChangeVariantButton.js

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Divider, Box, Button } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/changevariantbutton.module.css';
import { useMediaQuery } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { setHasSeenVariantPopup, setPageSlug } from '@/store/slices/variantPreferenceSlice'; // Import actions

export default function ChangeVariantButton({ category }) {
    const [showPopup, setShowPopup] = useState(false);
    const [variants, setVariants] = useState([]);
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const isSmallDevice = useMediaQuery('(max-width: 600px)');
    const router = useRouter();
    const dispatch = useDispatch();

    // Access variant preferences from Redux for this category
    const categoryPreferences = useSelector(
        (state) => state.variantPreference[category._id]
    );

    const hasSeenVariantPopup = categoryPreferences?.hasSeenVariantPopup || false;

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

    useEffect(() => {
        if (variants.length > 2 && !hasSeenVariantPopup) {
            const timer = setTimeout(() => {
                setShowPopup(true);
                dispatch(setHasSeenVariantPopup({ categoryId: category._id, hasSeen: true })); // Update Redux state
            }, 3000); // 3 seconds delay

            return () => clearTimeout(timer);
        }
    }, [variants, hasSeenVariantPopup, dispatch, category._id]);

    if (variants.length < 2) return null; // Only show button if there are multiple variants

    const handleVariantClick = (slug) => {
        dispatch(setPageSlug({ categoryId: category._id, pageSlug: slug })); // Update Redux state
        router.push(`/shop${slug}`);
        setShowPopup(false);
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
                        maxWidth: '600px',
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
                    <Box display="flex" flexDirection="column" gap="1rem">
                        {variants.map((variant) => (
                            <Box
                                key={variant.id}
                                onClick={() => handleVariantClick(variant.pageSlug)}
                                className={styles.variantBox}
                                style={{ cursor: 'pointer' }}
                            >
                                {variant.image && (
                                    <Image
                                        src={`${baseImageUrl}${variant.image}`}
                                        className={styles.customImg}
                                        alt={variant.name}
                                        width={360 * 1.5}
                                        height={150 * 1.5}
                                    />
                                )}
                                <Box
                                    className={styles.variantInfoParentBox}>
                                    <button
                                        variant="contained"
                                        className={styles.variantButton}
                                    >
                                        {variant?.name?.toLowerCase().includes('tank')
                                            ? variant.name.split(' ')[0]
                                            : variant.name
                                        }
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
