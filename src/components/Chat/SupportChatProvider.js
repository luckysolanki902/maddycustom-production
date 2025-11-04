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

  // Allow other components to open the chat dialog
  useEffect(() => {
    const handleOpen = () => setOpen(true);

    window.addEventListener('mc-open-chat-dialog', handleOpen);
    document.addEventListener('mc-open-chat-dialog', handleOpen);

    return () => {
      window.removeEventListener('mc-open-chat-dialog', handleOpen);
      document.removeEventListener('mc-open-chat-dialog', handleOpen);
    };
  }, []);

  useBackButtonToClose(open, () => setOpen(false));

  return (
    <SupportChatDialog open={open} onClose={() => setOpen(false)} userId={orderUserId} />
  );
}
