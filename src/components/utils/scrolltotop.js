"use client"
import React from 'react';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const ScrollToTop = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // This adds the smooth scrolling behavior
    });
  };
  return (
    <div
      style={{
        position: 'fixed',
        right: '2rem',
        bottom: '1rem',
        zIndex: '99999',
        cursor: 'pointer' // Add a pointer cursor for better UX
      }}
      onClick={scrollToTop}
    >
      <KeyboardArrowUpIcon style={{ color: 'gray', fontSize: '2rem' }} />
    </div>
  );
};

export default ScrollToTop;