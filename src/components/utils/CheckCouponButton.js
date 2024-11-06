import React from 'react'
import styled from '@emotion/styled';
import {
    Button,
  } from '@mui/material';
import Image from 'next/image';

const CouponButton = styled(Button)({
    background: '#E6F0E6', // Success green color
    color: '#000000', // White text color
    boxShadow: 'none',
    textTransform: 'none',
    fontFamily: 'Jost',
    padding: '0.2rem 1.3rem',
    borderRadius: '0.7rem',
    '&:hover': {
        background: '#e3f8e3', // Darker shade on hover
        boxShadow: 'none',
    },
});

export default function CheckCouponButton() {
  return (
    <CouponButton onClick={() => {
        if (couponState.couponApplied === false) {
            setIsCouponDialogOpen(true)
        }
    }} style={{ marginLeft: '2rem' }} variant='contained' >
        <Image src={'/images/icons/coupon3.png'} style={{ marginRight: '2rem', width: '2.5rem', height: 'auto' }} width={324 / 4} height={324 / 4} alt=''></Image>
        {couponState.couponApplied === true ? couponState.couponName : 'Check coupons'}

    </CouponButton>
  )
}
