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
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSpring, animated } from 'react-spring';

/**
 * Small utility component for "Copy to Clipboard" actions
 */
const CopyButton = ({ text, label }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Button
      variant="contained"
      size="small"
      onClick={handleCopy}
      sx={{
        textTransform: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: '8px',
        fontWeight: '500',
        boxShadow: 'none',
        backgroundColor: 'rgba(66, 66, 66, 0.9)',
        color: '#fff',
      }}
    >
      {label}
      <ContentCopyIcon fontSize="small" />
    </Button>
  );
};

/**
 * Step 1: Parse out two types of tokens in the text:
 *   1) {link: <URL>, linkText: <Descriptive Text>}
 *   2) {copyToClipboardLink: <Value>, linkText: <Label>}
 *
 * Step 2: On the leftover plain text, parse specialized highlight tags:
 *    <HLA>  for Amount
 *    <HLD>  for Date
 *    <HLP>  for Payment status
 *    <HLDS> for Delivery status
 */
function formatMessage(str) {
  const tokenRegex =
    /{(link|copyToClipboardLink)\s*:\s*([^,]+)\s*,\s*linkText\s*:\s*([^}]+)}/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(str)) !== null) {
    const [fullMatch, tokenType, tokenValue, linkText] = match;
    const start = match.index;

    // Push any plain text before this token
    if (start > lastIndex) {
      const textChunk = str.slice(lastIndex, start);
      // Parse highlight tags in that text chunk:
      parts.push(...parseHighlightTags(textChunk));
    }

    // Handle the token
    if (tokenType === 'link') {
      // It's a clickable link
      parts.push(
        <a
          key={`link-${start}`}
          href={tokenValue.trim()}
          style={{
            color: '#1976d2',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 500,
            margin: '0 3px',
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkText.trim()}
        </a>
      );
    } else if (tokenType === 'copyToClipboardLink') {
      // It's a button that copies text to clipboard
      parts.push(
        <CopyButton
          key={`copy-${start}`}
          text={tokenValue.trim()}
          label={linkText.trim()}
        />
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Push any remaining text after the last token
  if (lastIndex < str.length) {
    const remainder = str.slice(lastIndex);
    parts.push(...parseHighlightTags(remainder));
  }

  return parts;
}

/**
 * Parse our four custom highlight tags:
 *   <HLA>...</HLA>   (Amount)
 *   <HLD>...</HLD>   (Date)
 *   <HLP>...</HLP>   (Payment)
 *   <HLDS>...</HLDS> (Delivery)
 */
function parseHighlightTags(text) {
  // We'll match pairs like <HLA>some text</HLA> or <HLD>some text</HLD>, etc.
  const tagRegex = /<(HLA|HLD|HLP|HLDS)>(.*?)<\/\1>/gi;

  const styles = {
    HLA: {
      // color: '#388e3c',
      color: '#424242',
      fontWeight: '500',
      borderBottom: '1px dotted #388e3c',
    },
    HLD: {
      // color: '#795548',
      color: '#424242',
      fontWeight: '500',
      borderBottom: '1px dotted #795548',
    },
    HLP: {
      // color: '#2196f3',
      color: '#424242',
      fontWeight: '500',
      borderBottom: '1px dotted #2196f3',
    },
    HLDS: {
      // color: '#f44336',
      color: '#424242',
      fontWeight: '500',
      borderBottom: '1px dotted #f44336',
    },
  };

  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const [fullMatch, tagName, insideText] = match;
    const start = match.index;

    // Push plain text before this tag
    if (start > lastIndex) {
      segments.push(text.slice(lastIndex, start));
    }

    // Push a styled React element for this highlight
    segments.push(
      <span key={`hl-${start}`} style={styles[tagName]}>
        {insideText}
      </span>
    );

    lastIndex = tagRegex.lastIndex;
  }

  // Remainder after the last match
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
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
    to: {
      opacity: updateMessage ? 1 : 0,
      transform: updateMessage ? 'translateY(0px)' : 'translateY(20px)',
    },
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
          borderRadius: '16px',
          backgroundColor: '#fff',
          color: '#333',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '4px',
        },
      }}
    >
      <animated.div style={fadeIn}>
        <DialogTitle
          sx={{
            color: '#424242',
            fontWeight: '600',
            fontSize: '1.25rem',
            borderBottom: '1px solid #ddd',
            mb: 1,
          }}
        >
          Support Chat
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8, color: '#424242' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ backgroundColor: '#fff' }}>
          {isLoading ? (
            <Box sx={{ padding: '20px' }}>
              <Skeleton variant="text" width="80%" height={20} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="90%" height={20} />
            </Box>
          ) : (
            <Typography
              variant="body1"
              sx={{ mb: 2, fontSize: '1rem', lineHeight: 1.6, color: '#333' }}
            >
              {formatMessage(message)}
            </Typography>
          )}

          {showResolutionQuestion && !updateMessage && (
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ color: '#424242', fontWeight: 500, mb: 1 }}
              >
                Was your query resolved?
              </Typography>
              <Box sx={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  sx={{
                    flex: 1,
                    minWidth: '120px',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: '600',
                    backgroundColor: '#4caf50',
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: '#43a047',
                    },
                  }}
                  onClick={() => handleUpdateStatus(true)}
                >
                  Yes
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: '120px',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: '600',
                    borderColor: '#424242',
                    color: '#424242',
                    '&:hover': {
                      borderColor: '#616161',
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                  onClick={() => handleUpdateStatus(false)}
                >
                  No
                </Button>
              </Box>
            </Box>
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
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                {updateMessage}
              </Typography>
            </animated.div>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: 'center',
            py: 2,
            backgroundColor: '#fff',
          }}
        >
          <Button
            onClick={onClose}
            variant="text"
            sx={{
              color: '#424242',
              textTransform: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </animated.div>
    </Dialog>
  );
};

export default ChatDialog;
