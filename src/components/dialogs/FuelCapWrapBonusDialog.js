"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { keyframes } from '@mui/system';

const slideUp = keyframes`
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-6px);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
`;

export default function FuelCapWrapBonusDialog({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: '#ffffff',
          boxShadow: '0 32px 64px rgba(45, 45, 45, 0.15)',
          border: '1px solid rgba(45, 45, 45, 0.08)',
          animation: `${slideUp} 0.6s ease-out`,
          overflow: 'visible',
          position: 'relative',
        },
      }}
    >
      <DialogContent sx={{ position: 'relative', p: 0 }}>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: '#2d2d2d',
            opacity: 0.6,
            zIndex: 2,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(45, 45, 45, 0.08)',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            px: 5,
            py: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              width: 90,
              height: 90,
              borderRadius: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // background: 'linear-gradient(135deg, #111827, #1f2937)',
              // boxShadow: '0 20px 40px rgba(45, 45, 45, 0.25)',
              color: '#ffffff',
              fontSize: '4.4rem',
              animation: `${pulse} 3s ease-in-out infinite, ${float} 5s ease-in-out infinite`,
            }}
            role="img"
            aria-label="celebration"
          >
            🎉
          </Box>

          <Box sx={{ maxWidth: 320 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#2d2d2d',
                fontSize: '1.55rem',
                lineHeight: 1.3,
                mb: 1.5,
              }}
            >
              Free gift unlocked
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(45, 45, 45, 0.75)',
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.6,
              }}
            >
              You will receive one free fuel cap wrap with this order.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#2d2d2d',
                fontWeight: 600,
                mt: 1.75,
                fontSize: '0.9rem',
              }}
            >
              Thanks for adding two premium wraps to your cart.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 5,
          pb: 5,
          pt: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '16px',
            px: 4,
            py: 1.6,
            fontWeight: 600,
            fontSize: '0.95rem',
            textTransform: 'none',
            color: '#ffffff',
            background: '#2d2d2d',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 24px rgba(45, 45, 45, 0.25)',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              background: 'linear-gradient(120deg, rgba(255,255,255,0.18), rgba(255,255,255,0))',
              backgroundSize: '200% 200%',
              animation: `${shimmer} 2.8s linear infinite`,
            },
            '&:hover': {
              background: '#1f2937',
              boxShadow: '0 16px 32px rgba(45, 45, 45, 0.3)',
            },
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
