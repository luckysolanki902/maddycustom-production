// components/page-sections/viewcart/Footer.js

'use client';

import React from 'react';
import { Typography } from '@mui/material';
import BlackButton from '@/components/utils/BlackButton';
import styles from './styles/viewcart.module.css';

const Footer = ({ totalCost, originalTotal, onCheckout }) => (
  <footer className={styles.footer}>
    <div className={styles.totalCost}>
      <Typography variant="h6" sx={{ marginLeft: '0' }}>
        Total Cost
      </Typography>
      <Typography variant="body1" sx={{ marginLeft: '0.3rem', color: 'rgba(0,0,0,0.7)' }}>
        <span style={{ fontSize: '0.7rem', marginRight: '0.2rem' }}>₹</span>{totalCost.toFixed(2)}
      </Typography>
      {originalTotal && (
        <Typography variant="body2" color="textSecondary">
          Original Total: <span className={styles.originalTotal}>₹{originalTotal.toFixed(2)}</span>
        </Typography>
      )}
    </div>
    <BlackButton isLoading={false} buttonText="ORDER" onClick={onCheckout} />
  </footer>
);

export default Footer;
