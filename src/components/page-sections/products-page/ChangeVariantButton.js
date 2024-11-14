// @/components/page-sections/products-page/ChangeVariantButton.js
"use client";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Typography, Divider, Box, Button } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/changevariantbutton.module.css'
export default function ChangeVariantButton({ category }) {
    const [showPopup, setShowPopup] = useState(false);
    const [variants, setVariants] = useState([]);
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const router = useRouter();
    useEffect(() => {
        const fetchVariants = async () => {
            const response = await fetch(`/api/features/get-variants?categoryId=${category._id}`);
            const data = await response.json();
            if (data.hasMultiple) {
                setVariants(data.variants);
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
            <div className={styles.bikeStyleMain}>
                <div className={styles.bikeStyle} onClick={() => setShowPopup(true)} variant="contained" sx={{ margin: '1rem 0' }}>
                    Change Variant
                </div>
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
                <DialogContent sx={{ padding: '2rem 0.5rem 1rem 0.5rem' }}>
                    <Typography variant="h5" align="center" fontWeight="bold" sx={{ marginBottom: '10px' }}>
                        CHOOSE
                    </Typography>
                    <Typography variant="body1" align="center" gutterBottom>
                        {category.name} category
                    </Typography>
                    <Divider sx={{ margin: '20px 0' }} />
                    <Box display="flex" flexDirection="column" gap="1rem">
                        {variants.map((variant) => (
                            <Box key={variant.id} onClick={() => handleVariantClick(variant.pageSlug)} sx={{ cursor: 'pointer', padding: '1rem', borderRadius: '1rem', boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)', display: 'flex', alignItems: 'center', backgroundColor: '#D9D9D9', gap: '1.5rem' }}>
                                {variant.image && (
                                    <Image src={`${baseImageUrl}${variant.image}`} style={{ width: '100%', height: 'auto', cursor: 'pointer', maxWidth: '200px', borderRadius: '0.7rem', }} alt={variant.name} width={150} height={150} />
                                )}
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">
                                        {variant.name}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
