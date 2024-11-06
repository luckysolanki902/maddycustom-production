// components/page-sections/viewcart/ViewCartHeader.js

'use client';

import React from 'react';
import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import styles from './styles/viewcart.module.css';

const ViewCartHeader = ({ totalQuantity, onBack }) => (
  <header className={styles.header}>
    <IconButton onClick={onBack}>
      <ArrowBackIcon sx={{ color: 'black' }} />
    </IconButton>
    <h1 className={styles.heading}>
      My Cart <span>({totalQuantity})</span>
    </h1>
  </header>
);

export default ViewCartHeader;
