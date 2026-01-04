'use client';

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import SupportChatDialog from './SupportChatDialog';
import useBackButtonToClose from './useBackButtonToClose';

/**
 * Global chat entry point rendered from layout.
 * Listens for the "mc-open-chat-dialog" custom event fired by CTA elements
 * like the animated search box and opens the SupportChatDialog in response.
 */
export default function SupportChatProvider() {
  const orderUserId = useSelector(s => s.orderForm.userDetails?.userId);
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState(null);

  // Allow other components to open the chat dialog
  useEffect(() => {
    const handleOpen = (e) => {
      // Check if event has a query parameter (from search dialog)
      const query = e?.detail?.query || null;
      setInitialQuery(query);
      setOpen(true);
    };

    window.addEventListener('mc-open-chat-dialog', handleOpen);
    document.addEventListener('mc-open-chat-dialog', handleOpen);

    return () => {
      window.removeEventListener('mc-open-chat-dialog', handleOpen);
      document.removeEventListener('mc-open-chat-dialog', handleOpen);
    };
  }, []);

  useBackButtonToClose(open, () => setOpen(false));

  const handleClose = () => {
    setOpen(false);
    setInitialQuery(null);
  };

  return (
    <SupportChatDialog open={open} onClose={handleClose} userId={orderUserId} initialQuery={initialQuery} />
  );
}
