'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSpring, animated } from 'react-spring';

// Link formatter
function formatMessage(str) {
  const linkRegex = /\{link:\s*(https?:\/\/[^\s]+|\/[^\s]+)\s*,\s*linkText:\s*([^}]+)\}/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(str)) !== null) {
    const [fullMatch, url, text] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(str.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={start}
        href={url}
        style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text}
      </a>
    );

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return parts;
}

const ChatDialog = ({ open, onClose, message, requestId }) => {
  const isLoading = !message;
  const [showResolutionQuestion, setShowResolutionQuestion] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  // Entrance animation
  const fadeIn = useSpring({
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0px)' : 'translateY(-10px)',
    config: { tension: 200, friction: 20 },
  });

  // Confirmation message animation
  const confirmAnimation = useSpring({
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: updateMessage ? 1 : 0, transform: updateMessage ? 'translateY(0px)' : 'translateY(20px)' },
    config: { tension: 170, friction: 20 },
  });

  useEffect(() => {
    if (!isLoading) {
      setShowResolutionQuestion(true);
    }
  }, [isLoading]);

  const handleUpdateStatus = async (resolved) => {
    try {
      const res = await fetch('/api/support/update-query-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, resolved }),
      });
      const data = await res.json();
      if (data.message) {
        setShowResolutionQuestion(false);
        setUpdateMessage(
          resolved
            ? '✅ Thank you for confirming!'
            : '☹️ Sorry for the inconvenience. Your query will be resolved within 24 hours.'
        );
      }
    } catch (error) {
      console.error('Error updating status', error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        style: {
          borderRadius: '18px',
          backgroundColor: '#fff',
          color: '#424242',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        },
      }}
    >
      <animated.div style={fadeIn}>
        <DialogTitle sx={{ color: '#424242', fontWeight: '600' }}>
          Support Chat
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8, color: '#424242' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {isLoading ? (
            <div style={{ padding: '20px' }}>
              <Skeleton variant="text" width="80%" height={20} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="90%" height={20} />
            </div>
          ) : (
            <Typography variant="body1" sx={{ mb: 2, fontSize: '1rem' }}>
              {formatMessage(message)}
            </Typography>
          )}

          {showResolutionQuestion && !updateMessage && (
            <div style={{ marginTop: '20px' }}>
              <Typography variant="subtitle1" sx={{ color: '#424242' }}>
                Was your query resolved?
              </Typography>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ flex: 1, minWidth: '120px' }}
                  onClick={() => handleUpdateStatus(true)}
                >
                  Yes
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ flex: 1, minWidth: '120px' }}
                  onClick={() => handleUpdateStatus(false)}
                >
                  No
                </Button>
              </div>
            </div>
          )}

          {updateMessage && (
            <animated.div
              style={{
                ...confirmAnimation,
                marginTop: '20px',
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #4caf50, #81c784)',
                color: '#fff',
                fontWeight: '500',
              }}
            >
              <Typography variant="h6">{updateMessage}</Typography>
            </animated.div>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', padding: 2 }}>
          <Button onClick={onClose} sx={{ color: '#424242' }}>
            Close
          </Button>
        </DialogActions>
      </animated.div>
    </Dialog>
  );
};

export default ChatDialog;
