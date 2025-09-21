'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
// Removed external MUI dialog for inline confirmation
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
// Using shared session context
import { useChatSession } from './ChatSessionContext';
import { v4 as uuidv4 } from 'uuid';

// Speed themed loading dots
const LoadingPulse = () => (
  <div style={{ display: 'flex', gap: 6, padding: '6px 4px' }}>
    {[0, 0.15, 0.3].map(d => (
      <motion.span
        key={d}
        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 0.9, delay: d, ease: 'easeInOut' }}
        style={{ width: 8, height: 8, background: '#2d2d2d', borderRadius: 8 }}
      />
    ))}
  </div>
);

// Route-specific initial template sets
const templateSets = {
  home: [
    'Show me popular wrap designs',
    'Help me pick a car accessory',
    'Do you ship Pan India?',
    'What makes your wraps unique?',
  ],
  productList: [
    'Best selling pillar wraps?',
    'Suggest a theme for my car',
    'Show bike tank wraps (medium)',
    'What’s your fastest shipping option?',
  ],
  productDetail: [
    'Is this size right for my bike?',
    'Any install tips for this wrap?',
    'Care instructions after install?',
    'Do you have similar styles?',
  ],
  orderSuccess: [
    'Track my new order',
    'Change shipping address (possible?)',
    'Add another item to order?',
    'When will packaging start?',
  ],
  faq: [
    'Shipping time details',
    'Wrap durability & care',
    'Tank wrap sizing help',
    'Order tracking support',
  ],
  fallback: [
    'Where is my order?',
    'Help me choose the right pillar wrap',
    'How do I install a tank wrap?',
    'What size wrap fits my bike?',
    'How long does shipping take?',
    'Suggest a fragrance for my car',
  ]
};

export default function SupportChatDialog({ open, onClose, userId }) {
  const pathname = usePathname();
  const { isCartDrawerOpen, isSidebarOpen, isSearchDialogOpen } = useSelector(s => s.ui);
  const hidden = isCartDrawerOpen || isSidebarOpen || isSearchDialogOpen;

  // Ignore passed userId now; session provider handles identity
  const { messages, loading, loadingHistory, pendingAssistant, retryLast, sendMessage, resetChat } = useChatSession() || {};
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);

  // Determine route type for template selection
  const routeType = useMemo(() => {
    if (!pathname) return 'fallback';
    if (pathname === '/') return 'home';
    if (pathname === '/faqs') return 'faq';
    if (/^\/orders\/myorder\//.test(pathname)) return 'orderSuccess';
    if (pathname.startsWith('/shop')) {
      const parts = pathname.split('/').filter(Boolean); // e.g. ['shop','a','b']
      if (parts.length === 1 + 4) return 'productList'; // /shop/a/b/c/d -> list
      if (parts.length === 1 + 5) return 'productDetail'; // /shop/a/b/c/d/e -> detail
      return 'productList';
    }
    return 'fallback';
  }, [pathname]);

  const initialTemplates = templateSets[routeType] || templateSets.fallback;
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
    setShowTemplates(false);
  }, [input, sendMessage]);

  const handleTemplate = (t) => {
    sendMessage(t);
    setShowTemplates(false);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const handleNewChatClick = () => {
    if (messages.length < 1) {
      // No messages -> immediate reset
      resetChat().then(() => setShowTemplates(true));
      return;
    }
    setConfirmOpen(true);
  };
  const handleConfirmClose = () => setConfirmOpen(false);
  const handleConfirmReset = async () => {
    await resetChat();
    setShowTemplates(true);
    setConfirmOpen(false);
  };

  if (!open || hidden) return null;
  if (!messages) return null; // session not ready yet

  return (
    <AnimatePresence>
      <motion.div
        key="support-chat"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 24,
          zIndex: 3000,
          width: 'min(420px, 92vw)',
          height: '560px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 28,
          boxShadow: '0 18px 48px -8px rgba(0,0,0,0.25)',
          background: '#ffffff',
          border: '1px solid rgba(45,45,45,0.12)',
          overflow: 'hidden',
          fontFamily: 'Jost, sans-serif'
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(45,45,45,0.08)', background: 'linear-gradient(120deg,#ffffff,#f5f5f5)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 16, background: '#2d2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, letterSpacing: 0.5, fontSize: 14 }}>MD</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2d2d2d' }}>MaddyCustom Support</div>
            <div style={{ fontSize: 11, color: 'rgba(45,45,45,0.55)', fontWeight: 500 }}>{loadingHistory ? 'Loading conversation…' : 'Ask anything about your order, wraps & accessories'}</div>
          </div>
          <button onClick={handleNewChatClick} title="New chat" style={iconBtnStyle}>↺</button>
          <button onClick={onClose} title="Close" style={iconBtnStyle}>×</button>
        </div>

        {/* Messages */}
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 12px', background: 'radial-gradient(circle at 80% 10%, rgba(45,45,45,0.04), transparent 60%)' }}>
          {messages.length === 0 && !loadingHistory && (
            <div style={{ textAlign: 'center', marginTop: 40, color: 'rgba(45,45,45,0.55)', fontSize: 14, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: '#2d2d2d' }}>Welcome Rider 👋</div>
              <div style={{ marginBottom: 16 }}>Pick a quick question or type your own to get started.</div>
              {showTemplates && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {initialTemplates.map(t => (
                    <motion.button
                      key={t}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleTemplate(t)}
                      style={templateBtnStyle}
                    >{t}</motion.button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map(m => (
            <motion.div key={m.id || uuidv4()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
              <div style={m.role === 'user' ? userBubbleStyle : botBubbleStyle}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                <div style={timeStyle}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
              </div>
            </motion.div>
          ))}
          {pendingAssistant && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
              <div style={botBubbleStyle}><LoadingPulse /></div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '14px 16px 16px', borderTop: '1px solid rgba(45,45,45,0.08)', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              style={textAreaStyle}
              rows={1}
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              disabled={!input.trim() || loading || pendingAssistant}
              onClick={handleSend}
              style={{ ...sendBtnStyle, opacity: !input.trim() || loading || pendingAssistant ? 0.6 : 1 }}
            >
              {loading || pendingAssistant ? '...' : 'Send'}
            </motion.button>
          </div>
          {/* Retry inline if last assistant message had error meta */}
          {messages.length > 0 && messages[messages.length - 1].meta?.error && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button onClick={retryLast} style={retryBtnStyle}>Retry</button>
            </div>
          )}
        </div>
      </motion.div>
      {confirmOpen && (
        <motion.div
          key="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            zIndex: 3100,
            width: 'min(420px, 92vw)',
            height: '560px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            style={{
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(45,45,45,0.15)',
              boxShadow: '0 18px 48px -8px rgba(0,0,0,0.35)',
              borderRadius: 26,
              padding: '28px 26px 24px',
              width: '84%',
              maxWidth: 360,
              textAlign: 'center',
              pointerEvents: 'auto',
              fontFamily: 'Jost, sans-serif'
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: '#2d2d2d', marginBottom: 10 }}>Start New Chat?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(45,45,45,0.70)', fontWeight: 500, marginBottom: 18 }}>
              This clears only local messages. Server history stays for quality. Proceed?
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={handleConfirmClose} style={overlayBtnSecondary}>Cancel</button>
              <button onClick={handleConfirmReset} style={overlayBtnPrimary}>Start Fresh</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const iconBtnStyle = {
  background: 'rgba(45,45,45,0.06)',
  border: '1px solid rgba(45,45,45,0.15)',
  color: '#2d2d2d',
  width: 34,
  height: 34,
  borderRadius: 12,
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const templateBtnStyle = {
  background: '#ffffff',
  border: '1px solid rgba(45,45,45,0.15)',
  padding: '8px 12px',
  borderRadius: 14,
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 500,
  color: '#2d2d2d',
  boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
};

const baseBubble = {
  padding: '10px 14px 16px',
  borderRadius: 22,
  maxWidth: '78%',
  fontSize: 14,
  lineHeight: 1.5,
  letterSpacing: 0.2,
  position: 'relative',
  boxShadow: '0 8px 22px -6px rgba(0,0,0,0.08)'
};
const userBubbleStyle = {
  ...baseBubble,
  background: '#2d2d2d',
  color: '#ffffff',
  borderBottomRightRadius: 8,
  fontWeight: 500,
};
const botBubbleStyle = {
  ...baseBubble,
  background: '#f5f5f5',
  color: '#2d2d2d',
  borderBottomLeftRadius: 8,
  fontWeight: 500,
};
const timeStyle = {
  fontSize: 10,
  opacity: 0.55,
  marginTop: 6,
  textAlign: 'right',
  fontWeight: 500,
};
const textAreaStyle = {
  flex: 1,
  resize: 'none',
  border: '1px solid rgba(45,45,45,0.18)',
  borderRadius: 18,
  padding: '12px 14px',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1.4,
  background: '#fff',
  color: '#2d2d2d',
  fontWeight: 500,
  boxShadow: '0 4px 14px -4px rgba(0,0,0,0.06)'
};
const sendBtnStyle = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  borderRadius: 18,
  padding: '0 22px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: 0.3,
  boxShadow: '0 6px 20px -6px rgba(0,0,0,0.4)'
};
const overlayBtnPrimary = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 18,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: 0.3,
  boxShadow: '0 6px 20px -6px rgba(0,0,0,0.4)'
};
const overlayBtnSecondary = {
  background: 'rgba(45,45,45,0.08)',
  color: '#2d2d2d',
  border: '1px solid rgba(45,45,45,0.25)',
  padding: '10px 20px',
  borderRadius: 18,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13
};
