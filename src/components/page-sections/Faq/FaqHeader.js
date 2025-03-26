"use client";
// components/FaqHeader.js

import React from 'react';
import styles from './styles/Faq.module.css'
const FaqHeader = () => {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Manage your orders here</h1>
      <p className={styles.subtitle}>
        Track your order, resolve order issues, and get updates about your order here
      </p>
    </header>
  );
};



export default FaqHeader;
