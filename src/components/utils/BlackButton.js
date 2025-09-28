// components/utils/BlackButton.js

import { CircularProgress } from '@mui/material';
import React from 'react';
import styles from './styles/blackbutton.module.css';

export default function BlackButton({ isLoading, buttonText, type = 'button', disabled, onClick, className, style }) {
  return (
    <button
      className={`${styles.submitButton} ${className || ''}`}
      disabled={isLoading || disabled}
      type={type}
      onClick={onClick}
      style={{ cursor: isLoading || disabled ? 'not-allowed' : 'pointer', ...(style || {}) }}
    >
      {isLoading ? (
        <CircularProgress size={24} style={{ color: 'white' }} />
      ) : (
        buttonText
      )}
    </button>
  );
}
