'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import SupportChatDialog from './SupportChatDialog';
import useBackButtonToClose from './useBackButtonToClose';
import { usePathname } from 'next/navigation';

export default function SupportChatLauncher() {
  const { isCartDrawerOpen, isSidebarOpen, isSearchDialogOpen } = useSelector(s => s.ui);
  const orderUserId = useSelector(s => s.orderForm.userDetails?.userId);
  const hidden = isCartDrawerOpen || isSidebarOpen || isSearchDialogOpen;
  const [open, setOpen] = useState(false);
  const [showLauncher, setShowLauncher] = useState(false);
  const pathname = usePathname();

  // Allowed routes: home '/', product list (/shop + 4 extra segments), product detail (/shop + 5 extra), order success (/orders/myorder/:id)
  const routeAllowed = useMemo(() => {
    if (!pathname) return false;
    if (pathname === '/') return true;
    if (/^\/orders\/myorder\//.test(pathname)) return true;
    if (pathname.startsWith('/shop')) {
      const parts = pathname.split('/').filter(Boolean); // ['shop', ...]
      if (parts.length === 1 + 4) return true; // product list
      if (parts.length === 1 + 5) return true; // product detail
      return false; // other shop depths not allowed
    }
    return false; // hide on /faqs and all others
  }, [pathname]);

  useEffect(() => {
    // delay showing launcher slightly for smoother entry
    const t = setTimeout(() => setShowLauncher(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Listen for custom event to open chat dialog
  useEffect(() => {
    const handleOpenChat = () => {
      setOpen(true);
    };
    window.addEventListener('mc-open-chat-dialog', handleOpenChat);
    return () => window.removeEventListener('mc-open-chat-dialog', handleOpenChat);
  }, []);

  // auto close if hidden state triggers
  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  // Hook to intercept browser back and close the chat instead of navigating back
  useBackButtonToClose(open, () => setOpen(false));

  if (hidden || !routeAllowed) return null;

  return (
    <>
      <SupportChatDialog open={open} onClose={() => setOpen(false)} userId={orderUserId} />
      <AnimatePresence>
        {showLauncher && !open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.5, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setOpen(true)}
            style={launcherStyle}
            aria-label="Open Support Chat"
          >
            <div style={{ fontSize: 20, lineHeight: '20px' }}>💬</div>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

const launcherStyle = {
  position: 'fixed',
  bottom: 14,
  right: 14,
  width: 62,
  height: 62,
  borderRadius: 22,
  background: '#2d2d2d',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 12px 34px -10px rgba(0,0,0,0.55), 0 0 0 4px rgba(45,45,45,0.25)',
  fontWeight: 600,
  fontFamily: 'Jost, sans-serif',
  letterSpacing: 0.5,
  zIndex: 2500,
  transition: 'background 160ms ease',
};
