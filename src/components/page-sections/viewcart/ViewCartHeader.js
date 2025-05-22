// components/page-sections/viewcart/ViewCartHeader.js

'use client';

import React from 'react';
import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { motion } from 'framer-motion';
import styles from './styles/viewcartheader.module.css';

const ViewCartHeader = ({ totalQuantity, onBack }) => {
  return (
    <div className={styles.headerContainer}>
      <div className={styles.headerLeft}>
        {onBack && (
          <motion.button
            className={styles.backButton}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
          >
            <ArrowBackIcon fontSize="small" />
          </motion.button>
        )}

        <div className={styles.headerTitle}>
          <h1 className={styles.title}>Your Cart</h1>
          {/* {totalQuantity > 0 && (
            <motion.span
              className={styles.counter}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              {totalQuantity}
            </motion.span>
          )} */}
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.iconContainer}>
          <ShoppingCartIcon className={styles.cartIcon} />
        </div>
      </div>
    </div>
  );
};

export default ViewCartHeader;
