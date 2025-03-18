'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const VariantDialog = ({ imageUrl, width = 400, height = 400 }) => {
  // Automatically open the dialog when the component mounts.
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      // Disable MUI's maxWidth so the dialog sizes exactly to the image.
      maxWidth={false}
      // Remove padding/margin, box shadow, etc. to avoid white space.
      PaperProps={{
        sx: {
          p: 0,
          m: 0,
          borderRadius: 0,
          boxShadow: 'none',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
    >
      {/* Close icon in the top-right corner, over the image */}
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          backgroundColor: 'rgba(255,255,255,0.7)',
          zIndex: 1,
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: 0, m: 0 }}>
        {/* 
          Provide explicit width and height to avoid layout shift.
          The "display: block" style removes default inline spacing. 
        */}
        <Image
          src={imageUrl}
          alt="Popup image"
          width={width}
          height={height}
          style={{ display: 'block' }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VariantDialog;
