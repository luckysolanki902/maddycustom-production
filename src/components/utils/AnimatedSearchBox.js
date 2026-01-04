'use client';

import React, { useState, useEffect } from 'react';
import { Box, TextField, InputAdornment } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const placeholderTexts = [
		'My car is red and my budget is 1000',
		'Find some stylish wraps for my bike',
		'Track my order with my phone number',
		'Suggest something for car interiors',
		'Show anime-inspired pillar wraps'
];

const AnimatedSearchBox = () => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(30);

  const handleClick = () => {
    // Dispatch custom event to trigger chat dialog open
    try {
      const event = new CustomEvent('mc-open-chat-dialog');
      window.dispatchEvent(event);
    } catch (e) {
      console.error('Failed to open chat dialog:', e);
    }
  };

  useEffect(() => {
    const currentFullText = placeholderTexts[currentTextIndex];

    const handleTyping = () => {
      if (!isDeleting) {
        // Typing
        if (displayText.length < currentFullText.length) {
          setDisplayText(currentFullText.substring(0, displayText.length + 1));
          setTypingSpeed(30);
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 800);
        }
      } else {
        // Deleting - 4x faster than typing (30/4 = 7.5ms)
        if (displayText.length > 0) {
          setDisplayText(currentFullText.substring(0, displayText.length - 1));
          setTypingSpeed(7.5);
        } else {
          // Move to next text
          setIsDeleting(false);
          setCurrentTextIndex((prevIndex) => (prevIndex + 1) % placeholderTexts.length);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentTextIndex, typingSpeed]);

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: { xs: '2rem 1rem', md: '3rem 1rem' },
      }}
    >
      <Box
        component="h2"
        sx={{
          fontSize: { xs: '1.5rem', md: '2rem' },
          fontWeight: 600,
          color: '#1a1a1a',
          marginBottom: { xs: '1rem', md: '1.5rem' },
          textAlign: 'center',
        }}
      >
        Ask Our AI
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: '800px',
          position: 'relative',
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder={displayText}
          onClick={handleClick}
          InputProps={{
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <AutoAwesomeIcon sx={{ color: '#718096', fontSize: 24 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            cursor: 'pointer',
            '& .MuiOutlinedInput-root': {
              cursor: 'pointer',
              borderRadius: { xs: '20px', md: '24px' },
              padding: { xs: '6px 16px', md: '8px 20px' },
              background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px #d1d5db',
              transition: 'all 0.3s ease',
              '& fieldset': {
                border: 'none',
              },
              '&:hover': {
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px #9ca3af',
              },
              '&.Mui-focused': {
                boxShadow: '0 8px 28px rgba(0, 0, 0, 0.15), 0 0 0 2px #4a5568',
              },
            },
            '& .MuiInputBase-input': {
              cursor: 'pointer',
              padding: { xs: '10px 6px', md: '12px 8px' },
              fontSize: { xs: '14px', md: '16px' },
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
              color: '#2d3748',
              '&::placeholder': {
                color: '#718096',
                opacity: 1,
              },
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default AnimatedSearchBox;
