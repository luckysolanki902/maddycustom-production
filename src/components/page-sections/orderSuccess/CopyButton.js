'use client';

import React from 'react';
import { Button } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function CopyButton({ textToCopy }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1000); // Reset after 1 second
      })
      .catch((err) => {
        console.error('Failed to copy!', err);
      });
  };

  return (
    <Button
      variant="outline"
      startIcon={<ContentCopyIcon />}
      onClick={handleCopy}
      sx={{
        width: 210, // Set a fixed width
        backgroundColor: copied ? 'success.main' : 'rgb(40, 40, 40)',
        color: 'white',
        borderColor: 'black',
        '&:hover': {
          backgroundColor: copied ? 'success.dark' : 'rgb(70, 70, 70)',
          borderColor: 'black',
        },
        transition: 'background-color 0.3s, border-color 0.3s, color 0.3s',
      }}
    >
      {copied ? 'Copied!' : 'Copy Order ID'}
    </Button>
  );
}
