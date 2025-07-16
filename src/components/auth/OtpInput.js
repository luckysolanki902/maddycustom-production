// @/components/auth/OtpInput.js
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Typography, styled } from '@mui/material';

const StyledOtpContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(1),
  margin: theme.spacing(2, 0),
}));

const StyledOtpInput = styled(TextField)(({ theme }) => ({
  width: '48px',
  height: '56px',
  textAlign: 'center',
  '& input': {
    textAlign: 'center',
    fontSize: '1.5rem',
    padding: theme.spacing(1, 0),
    caretColor: 'transparent',
  },
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
  },
}));

const OtpInput = ({ length = 6, value, onChange, disabled }) => {
  const [otp, setOtp] = useState(Array(length).fill(''));
  const inputRefs = useRef([]);

  // Initialize refs
  useEffect(() => {
    inputRefs.current = Array(length).fill(0).map((_, i) => inputRefs.current[i] || React.createRef());
  }, [length]);

  // Sync with parent value if provided
  useEffect(() => {
    if (value) {
      const digits = value.toString().split('').slice(0, length);
      setOtp([...digits, ...Array(length - digits.length).fill('')]);
    }
  }, [value, length]);

  const focusInput = (index) => {
    if (inputRefs.current[index]) {
      inputRefs.current[index].focus();
    }
  };

  const handleChange = (e, index) => {
    const { value } = e.target;
    
    if (value === '' || /^[0-9]$/.test(value)) {
      const newOtp = [...otp];
      
      // Only take the last character if pasting multiple characters
      newOtp[index] = value.slice(-1);
      setOtp(newOtp);
      
      // Call parent onChange with the new complete OTP
      const otpString = newOtp.join('');
      onChange(otpString);
      
      // Move focus forward if a digit was entered
      if (value !== '' && index < length - 1) {
        focusInput(index + 1);
      }
    }
  };

  const handleKeyDown = (e, index) => {
    // Handle backspace - move to previous input and clear
    if (e.key === 'Backspace') {
      if (index > 0 && otp[index] === '') {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        onChange(newOtp.join(''));
        focusInput(index - 1);
      } else if (otp[index] !== '') {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        onChange(newOtp.join(''));
      }
    } 
    // Handle arrow keys for navigation
    else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text/plain').trim();
    
    // Filter only digits
    const digits = pasteData.replace(/\D/g, '').slice(0, length).split('');
    
    if (digits.length > 0) {
      const newOtp = [
        ...digits,
        ...Array(Math.max(0, length - digits.length)).fill('')
      ];
      
      setOtp(newOtp.slice(0, length));
      onChange(newOtp.join('').slice(0, length));
      
      // Focus on the next empty input or the last input if all are filled
      const nextEmptyIndex = digits.length < length ? digits.length : length - 1;
      focusInput(nextEmptyIndex);
    }
  };

  const handleFocus = (e) => {
    // Select the content when focused for easier editing
    e.target.select();
  };

  return (
    <StyledOtpContainer>
      {Array(length).fill(0).map((_, index) => (
        <StyledOtpInput
          key={index}
          inputRef={(el) => (inputRefs.current[index] = el)}
          variant="outlined"
          value={otp[index]}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={handleFocus}
          onPaste={index === 0 ? handlePaste : undefined}
          disabled={disabled}
          inputProps={{
            maxLength: 1,
            inputMode: 'numeric',
            pattern: '[0-9]*',
            autoComplete: 'one-time-code',
          }}
          aria-label={`Digit ${index + 1} of verification code`}
        />
      ))}
    </StyledOtpContainer>
  );
};

export default OtpInput;
