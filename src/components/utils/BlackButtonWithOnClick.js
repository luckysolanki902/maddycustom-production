// components/utils/BlackButtonWithOnClick.js

import { CircularProgress } from '@mui/material';
import React from 'react';
import styles from './styles/blackbutton.module.css';

export default function BlackButtonWithOnClick({ isLoading, buttonText, onClick, type }) {
  return (
    <button
      className={styles.submitButton}
      disabled={isLoading}
      onClick={onClick}
      type={type}
      style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
    >
      {isLoading ? (
        <CircularProgress size={24} style={{ color: 'white' }} />
      ) : (
        buttonText
      )}
    </button>
  );
}
