'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useChatSession } from './ChatSessionContext';
import { v4 as uuidv4 } from 'uuid';
import ProductGalleryMessage from './ProductGalleryMessage';

// Static templates for FAQ page
const faqTemplates = [
  'Shipping time details',
  'Wrap durability & care',
  'Tank wrap sizing help',
  'Order tracking support',
];

export default function FaqPageChat() {
  const { messages, loading, pendingAssistant, loadingHistory, isResetting, sendMessage, resetChat, retryLast, invokeProductSearch } = useChatSession() || {};
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(messages.length === 0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
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
  // Instant new chat - no confirmation dialog, immediately clear and show skeletons
  const openReset = () => {
    resetChat();
    setShowTemplates(true);
  };

  if (!messages) return null; // session not ready

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 28px 20px' }}>
      <div style={{ border: '1px solid rgba(45,45,45,0.14)', background: '#fff', borderRadius: 34, display: 'flex', flexDirection: 'column', minHeight: 380, boxShadow: '0 18px 44px -14px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(45,45,45,0.08)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: '#2d2d2d', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>MD</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#2d2d2d' }}>Maddy.ai</div>
            <div style={{ fontSize: 12, color: 'rgba(45,45,45,0.55)', fontWeight: 500 }}>{isResetting ? 'Starting a new chat…' : (loadingHistory ? 'Loading...' : 'Ask anything or choose a topic')}</div>
          </div>
          <button onClick={openReset} title="New chat" style={{...iconBtn, opacity: isResetting ? 0.5 : 1, pointerEvents: isResetting ? 'none' : 'auto'}}>{isResetting ? '…' : '↺'}</button>
        </div>
        {isResetting && (
          <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror' }} style={{ height: 2, background: '#2d2d2d' }} />
        )}
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 16px', background: 'radial-gradient(circle at 80% 8%, rgba(45,45,45,0.04), transparent 65%)' }}>
          {messages.length === 0 && !loadingHistory && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#2d2d2d' }}>Quick Topics</div>
              {showTemplates && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {faqTemplates.map(t => (
                    <motion.button key={t} whileTap={{ scale: 0.94 }} disabled={isResetting} onClick={() => handleTemplate(t)} style={{...templateBtn, opacity: isResetting ? 0.55 : 1}}>{t}</motion.button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map(m => {
            if (m.type === 'product_gallery') {
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
                  <ProductGalleryMessage
                    products={m.products}
                    hasMore={m.hasMore}
                    pending={pendingAssistant}
                    onShowMore={() => invokeProductSearch({
                      query: m.queryEcho?.query,
                      maxPrice: m.queryEcho?.maxPrice,
                      minPrice: m.queryEcho?.minPrice,
                      keywords: m.queryEcho?.keywords,
                      categoryTitle: m.queryEcho?.categoryTitle,
                      classificationTags: m.queryEcho?.classificationTags,
                      excludeTags: m.queryEcho?.excludeTags,
                      diversifyCategories: m.queryEcho?.diversifyCategories,
                      page: (m.queryEcho?.page || 1) + 1,
                      limit: m.limit || 6
                    })}
                  />
                </div>
              );
            }
            return (
              <motion.div key={m.id || uuidv4()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
                <div style={m.role === 'user' ? userBubble : botBubble}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  <div style={timeMeta}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              </motion.div>
            );
          })}
          {pendingAssistant && <div style={botBubble}>...</div>}
        </div>
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(45,45,45,0.08)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message..."
              style={{...inputBox, opacity: isResetting ? 0.6 : 1}}
              rows={1}
            />
            <motion.button whileTap={{ scale: 0.94 }} disabled={!input.trim() || loading || pendingAssistant || isResetting} onClick={handleSend} style={{ ...sendBtn, opacity: (!input.trim() || loading || pendingAssistant || isResetting) ? 0.55 : 1 }}>{(loading || pendingAssistant || isResetting) ? '...' : 'Send'}</motion.button>
          </div>
          {messages.length > 0 && messages[messages.length - 1].meta?.error && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button onClick={retryLast} style={retryBtnStyle}>Retry</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const templateBtn = {
  background: '#ffffff',
  border: '1px solid rgba(45,45,45,0.16)',
  padding: '8px 12px',
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  color: '#2d2d2d',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};
const baseBubble = {
  padding: '10px 14px 16px',
  borderRadius: 22,
  maxWidth: '75%',
  fontSize: 13.5,
  lineHeight: 1.5,
  position: 'relative',
  fontWeight: 500,
  boxShadow: '0 8px 24px -10px rgba(0,0,0,0.12)'
};
const userBubble = { ...baseBubble, background: '#2d2d2d', color: '#fff', borderBottomRightRadius: 8 };
const botBubble = { ...baseBubble, background: '#f5f5f5', color: '#2d2d2d', borderBottomLeftRadius: 8 };
const timeMeta = { fontSize: 10, opacity: 0.55, marginTop: 6, textAlign: 'right' };
const inputBox = {
  flex: 1,
  resize: 'none',
  border: '1px solid rgba(45,45,45,0.18)',
  borderRadius: 18,
  padding: '12px 14px',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  background: '#fff',
  color: '#2d2d2d',
  fontWeight: 500,
  boxShadow: '0 6px 18px -8px rgba(0,0,0,0.08)'
};
const sendBtn = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  borderRadius: 18,
  padding: '0 24px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: 0.3,
  boxShadow: '0 10px 28px -12px rgba(0,0,0,0.45)'
};
const iconBtn = {
  background: 'rgba(45,45,45,0.06)',
  border: '1px solid rgba(45,45,45,0.15)',
  color: '#2d2d2d',
  width: 36,
  height: 36,
  borderRadius: 12,
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const retryBtnStyle = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 14,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600
};
const inlineOverlayWrap = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3500,
  padding: 20
};
const inlineOverlayCard = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(45,45,45,0.15)',
  borderRadius: 28,
  padding: '30px 30px 26px',
  width: 'min(400px,92vw)',
  boxShadow: '0 20px 56px -10px rgba(0,0,0,0.35)',
  textAlign: 'center',
  fontFamily: 'Jost, sans-serif'
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
