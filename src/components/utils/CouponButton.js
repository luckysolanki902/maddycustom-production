// components/utils/CouponButton.js

import React from 'react';
import styled from '@emotion/styled';
import { Button, IconButton } from '@mui/material';
import Image from 'next/image';
import { Close } from '@mui/icons-material';

const CouponButtonStyled = styled(Button)({
  background: '#E6F0E6', // Success green color
  color: '#000000', // Black text color
  boxShadow: 'none',
  textTransform: 'none',
  fontFamily: 'Jost, sans-serif',
  padding: '0.2rem 0.5rem 0.2rem 1rem',
  borderRadius: '0.7rem',
  display: 'flex',
  alignItems: 'center',
  '&:hover': {
    background: '#e3f8e3', // Darker shade on hover
    boxShadow: 'none',
  },
});

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

const CouponButton = ({ couponState, openCouponDialog, removeCoupon }) => {
  return (
    <CouponButtonStyled
      onClick={() => {
        if (!couponState.couponApplied) {
          openCouponDialog();
        }
      }}
      variant="contained"
    >
      <Image
        src={`${baseImageUrl}/assets/icons/coupon.png`}
        style={{ marginRight: '0.5rem', width: '2.5rem', height: 'auto' }}
        width={81} // 324 / 4
        height={81} // 324 / 4
        alt="Coupon Icon"
      />
      {couponState.couponApplied ? couponState.couponName.toUpperCase() : 'Check coupons'}

      {/* Render Close Button Only If Coupon is Applied */}
      {couponState.couponApplied && (

        <Close sx={{ marginLeft: '1rem', borderRadius: '50%', padding: '0.2rem', 
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          } 
        }}
          aria-label="Remove coupon" onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the parent button's onClick
            removeCoupon();
          }} />

      )}
    </CouponButtonStyled>
  );
};

export default CouponButton;
