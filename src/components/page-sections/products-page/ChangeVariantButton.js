// @/components/page-sections/products-page/ChangeVariantButton.js
"use client";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Typography, Divider, Box, Button } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/changevariantbutton.module.css'
import { useMediaQuery } from '@mui/material';
export default function ChangeVariantButton({ category }) {
    const [showPopup, setShowPopup] = useState(false);
    const [variants, setVariants] = useState([]);
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    const isSmallDevice = useMediaQuery('(max-width: 600px)');
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
                    <Typography variant="h5" align="center" sx={{ marginBottom: '10px', fontSize: '50px', '&::after': { content: '""', display: 'block', width: '50%', height: '2px', backgroundColor: 'black', margin: '5px auto 0', }, '@media (max-width: 600px)': { fontSize: '30px' } }}>
                        CHOOSE
                    </Typography>
                    <Typography variant="body1" align="center" gutterBottom sx={{ fontSize: '18px', marginTop: '30px', fontWeight: 'lighter' }}>
                        {category.name}
                    </Typography>
                    <Divider sx={{ margin: '20px 0' }} />
                    <Box display="flex" flexDirection="column" gap="1rem">
                        {variants.map((variant) => (
                            <Box key={variant.id} onClick={() => handleVariantClick(variant.pageSlug)} sx={{ cursor: 'pointer', padding: '1rem', borderRadius: '1rem', boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)', display: 'flex', alignItems: 'center', backgroundColor: '#D9D9D9', gap: '1.5rem' }}>
                                {variant.image && (
                                    <Image src={`${baseImageUrl}${variant.image}`} className={styles.customImg} alt={variant.name} width={120} height={50} />
                                )}
                                <Box display="flex" flexDirection="column" gap="1rem" >
                                    <Button
                                        variant="contained"
                                        sx={{
                                            backgroundColor: 'black',
                                            color: 'white',
                                            fontWeight: '500',
                                            textTransform: 'none',
                                            borderRadius: '10px',
                                            padding: '5px 15px',
                                            maxWidth: '150px',
                                            fontSize: '12px',
                                            boxShadow: 'none',
                                            '&:hover': {
                                                backgroundColor: 'black',
                                            },
                                            '@media (max-width: 600px)': { // Mobile screen size
                                                fontSize: '10px', // Font size for mobile
                                                padding: '5px 10px',
                                            },
                                        }}
                                    >
                                        {/* {console.log(window.innerWidth)} */}
                                        {variant.name.length > 12 && isSmallDevice ? variant.name.substring(0, 12) + '...' : variant.name}
                                    </Button>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: '#555',
                                            fontSize: '11px',
                                            fontFamily: 'Jost',
                                            lineHeight: 1.5,
                                            '@media (max-width: 600px)': { // Mobile screen size
                                                fontSize: '10px', // Font size for mobile

                                            },
                                        }}
                                    >
                                        Choose if your bike has a plain slim tank like: Pulsar, Xstream, Splendor, etc.
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
