// components/cards/CouponCard.js

import React from 'react';
import styles from './styles/couponcard.module.css';
import Image from 'next/image';
import { Button } from '@mui/material';

const CouponCard = ({ discount, discountType, validity, name, onApply, index }) => {
    const handleApplyClick = () => {
        // Call the function passed from CouponDialog to apply the coupon
        onApply(name, discount, discountType);
    };
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    return (
        <div className={styles.mainDiv} style={{filter: `hue-rotate(${index * 25}deg)`}}>
            <div className={styles.mdLogo}>
                <Image src={`${baseImageUrl}/assets/logos/md-logo-light.png`} width={1242 / 7} height={1614 / 7} alt='md' />
            </div>

            <div className={styles.percent}>
                {discountType === 'percentage' ? `${discount}%` : `₹${discount}`}
                <div>
                    {discountType === 'percentage' ? `${discount}%` : `₹${discount}`}
                </div>
            </div>
            <p>off</p>

            <div className={styles.cut}>
                <div className={styles.circle}></div>
                <div className={styles.validity}>
                    Valid till {validity}
                </div>
                <div className={styles.lineMain}>
                    <div className={styles.lines}></div>
                    <div className={styles.lines}></div>
                    <div className={styles.lines}></div>
                    <div className={styles.lines}></div>
                </div>
                <div className={styles.circle}></div>
            </div>

            <div className={styles.applyButton}>
                <Button variant="contained" color="primary" onClick={handleApplyClick}>
                    Apply
                </Button>
            </div>
        </div>
    );
}

export default CouponCard;
