// components/dialogs/ApplyCoupon.js

import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Image from 'next/image';
import styles from './styles/applycoupon.module.css';
import CouponCard from '../cards/CouponCard';
import { Typography } from '@mui/material';
import CustomSnackbar from '@/components/notifications/CustomSnackbar'; // Updated Import

const ApplyCoupon = ({ open, onClose, onApplyCoupon, totalCost }) => {
    const [couponCode, setCouponCode] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success', // 'success' or 'error'
    });
    const [availableCoupons, setAvailableCoupons] = useState([]);

    useEffect(() => {
        if (open) {
            // Fetch available coupons when dialog opens
            fetchAvailableCoupons();
        }
    }, [open]);

    const fetchAvailableCoupons = async () => {
        try {
            const res = await fetch('/api/checkout/coupons');
            const data = await res.json();

            if (res.ok) {
                setAvailableCoupons(data.coupons);
            } else {
                setSnackbar({
                    open: true,
                    message: data.message || 'Failed to fetch coupons.',
                    severity: 'error',
                });
            }
        } catch (error) {
            console.error('Error fetching coupons:', error);
            setSnackbar({
                open: true,
                message: 'An error occurred. Please try again.',
                severity: 'error',
            });
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) {
            setSnackbar({
                open: true,
                message: 'Please enter a coupon code.',
                severity: 'error',
            });
            return;
        }

        try {
            const res = await fetch('/api/checkout/coupons/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode.trim(), totalCost }),
            });

            const data = await res.json();

            if (res.ok && data.valid) {
                onApplyCoupon(couponCode.trim(), data.discountValue, data.discountType, true); // Indicate manual application
                onClose(); // Close dialog after applying coupon
            } else {
                setSnackbar({
                    open: true,
                    message: data.message || 'Invalid coupon code.',
                    severity: 'error',
                });
            }
        } catch (error) {
            console.error('Error applying coupon:', error);
            setSnackbar({
                open: true,
                message: 'An error occurred. Please try again.',
                severity: 'error',
            });
        }
    };

    const handleApplyCouponFromCard = async (name, discount, discountType) => {
        try {
            const res = await fetch('/api/checkout/coupons/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: name, totalCost }),
            });

            const data = await res.json();

            if (res.ok && data.valid) {
                setSnackbar({
                    open: true,
                    message: 'Coupon applied successfully!',
                    severity: 'success',
                });
                onApplyCoupon(name, data.discountValue, data.discountType, false); // Indicate selection from card
                onClose();
            } else {
                setSnackbar({
                    open: true,
                    message: data.message || 'Failed to apply coupon.',
                    severity: 'error',
                });
            }
        } catch (error) {
            console.error('Error applying coupon:', error);
            setSnackbar({
                open: true,
                message: 'An error occurred. Please try again.',
                severity: 'error',
            });
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen>
            <DialogContent style={{ backgroundColor: 'white', height: '100vh', padding: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', marginRight: '1rem' }}>

                    {/* Close Button */}
                        <Button color="inherit" onClick={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent:'center', padding:'1rem',  margin:'0 1rem' }}>
                            <Image
                                src={`${baseImageUrl}/assets/icons/lessthan1.png`}
                                width={46}
                                height={50}
                                alt="Back"
                                style={{ width: '1rem', height: 'auto' }}
                            />
                        </Button>

                    {/* Coupon Code Input */}
                    <div className={styles.inputMain} style={{ flexGrow: '1', display: 'flex' }}>
                        <TextField
                            autoFocus
                            spellCheck="false"
                            type="text"
                            placeholder="Type coupon code here"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            fullWidth
                            variant="outlined" // Ensure you're using the 'outlined' variant
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    // Remove the default border
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                    // Remove the border on hover
                                    '&:hover fieldset': {
                                        border: 'none',
                                    },
                                    // Remove the border when focused
                                    '&.Mui-focused fieldset': {
                                        border: 'none',
                                    },
                                },
                                // Optionally, remove the default browser outline for accessibility
                                '& input': {
                                    outline: 'none',
                                },
                            }}
                        />

                        <div style={{ color: 'black' }}>
                            <Button
                                color="inherit"
                                style={{ fontWeight: '600', flex: '0', borderRadius: '0.4rem' }}
                                onClick={handleApplyCoupon}
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Available Coupons */}
                <section className={styles.couponCardsSection}>
                    {availableCoupons.length > 0 ? (
                        availableCoupons.map((coupon) => (
                            <CouponCard
                                key={coupon._id}
                                name={coupon.code}
                                discount={coupon.discountValue}
                                discountType={coupon.discountType}
                                validity={new Date(coupon.validUntil).toLocaleDateString()}
                                onApply={handleApplyCouponFromCard}
                            />
                        ))
                    ) : (
                        <Typography variant="body2" color="textSecondary" align="center" sx={{ marginLeft: '0.5rem' }}>
                            No available coupons at the moment.
                        </Typography>
                    )}

                </section>
            </DialogContent>

            {/* Custom Snackbar for Feedback */}
            <CustomSnackbar
                open={snackbar.open}
                message={snackbar.message}
                severity={snackbar.severity}
                handleClose={handleSnackbarClose}
            />
        </Dialog>
    );
};

export default ApplyCoupon;
