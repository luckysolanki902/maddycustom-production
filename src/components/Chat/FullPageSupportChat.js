'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import helpingData from '@/lib/faq/helpingdata';
import { v4 as uuidv4 } from 'uuid';
import { useChatSession } from './ChatSessionContext';

const templates = [
  'Track my recent order',
  'Which wrap fits my bike?',
  'Installation help for tank wrap',
  'Shipping time to my location',
  'Durability & care tips',
  'Suggest a car fragrance',
];

export default function FullPageSupportChat() {
  const { messages, loading, loadingHistory, pendingAssistant, retryLast, sendMessage, resetChat } = useChatSession() || {};
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(messages.length === 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const openReset = () => {
    if (!messages) return;
    if (messages.length < 1) {
      resetChat();
      setShowTemplates(true);
    } else setConfirmOpen(true);
  };
  const doReset = async () => {
    await resetChat();
    setShowTemplates(true);
    setConfirmOpen(false);
  };

  if (!messages) return null; // session not ready

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 140px' }}>
      <header style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 52, fontWeight: 700, letterSpacing: -1, color: '#2d2d2d' }}>Customer Support Chat</h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.5, color: 'rgba(45,45,45,0.7)', fontWeight: 500 }}>Real-time help for orders, wraps, installation & accessories. Start with a template or ask anything.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={openReset} style={newChatBtn}>New Chat</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 40 }}>
        {/* Chat Panel */}
        <div style={{ background: '#fff', border: '1px solid rgba(45,45,45,0.12)', borderRadius: 34, minHeight: 580, display: 'flex', flexDirection: 'column', boxShadow: '0 18px 46px -12px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 26px', borderBottom: '1px solid rgba(45,45,45,0.08)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 18, background: '#2d2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>MC</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#2d2d2d' }}>MaddyCustom Support</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(45,45,45,0.55)' }}>{loadingHistory ? 'Loading chat...' : 'We respond with accurate, concise answers.'}</div>
            </div>
          </div>
          <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '26px 26px 18px', background: 'radial-gradient(circle at 85% 8%, rgba(45,45,45,0.04), transparent 65%)' }}>
            {messages.length === 0 && !loadingHistory && showTemplates && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#2d2d2d' }}>Quick Start</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {templates.map(t => (
                    <motion.button key={t} whileTap={{ scale: 0.94 }} onClick={() => handleTemplate(t)} style={templateBtn}>{t}</motion.button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(m => (
              <motion.div key={m.id || uuidv4()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 18 }}>
                <div style={m.role === 'user' ? userBubble : botBubble}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  <div style={timeMeta}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              </motion.div>
            ))}
            {pendingAssistant && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={botBubble}>…</div>
              </div>
            )}
          </div>
          <div style={{ padding: '18px 24px 24px', borderTop: '1px solid rgba(45,45,45,0.08)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type your message..."
                style={inputBox}
                rows={1}
              />
              <motion.button whileTap={{ scale: 0.94 }} disabled={!input.trim() || loading || pendingAssistant} onClick={handleSend} style={{ ...sendBtn, opacity: !input.trim() || loading || pendingAssistant ? 0.55 : 1 }}>{loading || pendingAssistant ? '...' : 'Send'}</motion.button>
            </div>
            {messages.length > 0 && messages[messages.length - 1].meta?.error && (
              <div style={{ marginTop: 12 }}>
                <button onClick={retryLast} style={retryBtn}>Retry</button>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge + Templates side */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(45,45,45,0.12)', borderRadius: 30, padding: 26, boxShadow: '0 12px 40px -14px rgba(0,0,0,0.12)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#2d2d2d', marginBottom: 10 }}>Knowledge Snapshot</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(45,45,45,0.72)', fontWeight: 500, maxHeight: 300, overflow: 'auto' }}>{helpingData.substring(0, 1400)}...</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid rgba(45,45,45,0.12)', borderRadius: 30, padding: 24, boxShadow: '0 12px 40px -14px rgba(0,0,0,0.12)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#2d2d2d', marginBottom: 12 }}>More Starters</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {templates.map(t => (
                <motion.button key={`side-${t}`} whileTap={{ scale: 0.94 }} onClick={() => handleTemplate(t)} style={sideTemplate}>{t}</motion.button>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {confirmOpen && (
        <div style={inlineOverlayWrap}>
          <div style={inlineOverlayCard}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#2d2d2d', marginBottom: 10 }}>Start New Chat?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(45,45,45,0.70)', fontWeight: 500, marginBottom: 18 }}>This clears only local messages. Server history stays for quality improvement.</div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              <button onClick={() => setConfirmOpen(false)} style={overlayBtnSecondary}>Cancel</button>
              <button onClick={doReset} style={overlayBtnPrimary}>Start Fresh</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const templateBtn = {
  background: '#ffffff',
  border: '1px solid rgba(45,45,45,0.16)',
  padding: '10px 14px',
  borderRadius: 18,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  color: '#2d2d2d',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};
const sideTemplate = { ...templateBtn, padding: '8px 12px', fontSize: 11 };
const bubbleBase = {
  padding: '12px 16px 18px',
  borderRadius: 26,
  maxWidth: '78%',
  fontSize: 14,
  lineHeight: 1.5,
  position: 'relative',
  fontWeight: 500,
  boxShadow: '0 8px 28px -10px rgba(0,0,0,0.12)'
};
const userBubble = { ...bubbleBase, background: '#2d2d2d', color: '#fff', borderBottomRightRadius: 10 };
const botBubble = { ...bubbleBase, background: '#f5f5f5', color: '#2d2d2d', borderBottomLeftRadius: 10 };
const timeMeta = { fontSize: 10, opacity: 0.55, marginTop: 6, textAlign: 'right' };
const inputBox = {
  flex: 1,
  resize: 'none',
  border: '1px solid rgba(45,45,45,0.2)',
  borderRadius: 20,
  padding: '14px 16px',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  background: '#fff',
  color: '#2d2d2d',
  fontWeight: 500,
  boxShadow: '0 6px 20px -8px rgba(0,0,0,0.08)'
};
const sendBtn = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  borderRadius: 18,
  padding: '0 28px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: 0.3,
  boxShadow: '0 10px 32px -12px rgba(0,0,0,0.45)'
};
const retryBtn = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  padding: '8px 18px',
  borderRadius: 18,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13
};
const newChatBtn = {
  background: '#fff',
  border: '1px solid rgba(45,45,45,0.35)',
  padding: '10px 20px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  color: '#2d2d2d'
};
const inlineOverlayWrap = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 4000,
  padding: 20
};
const inlineOverlayCard = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(45,45,45,0.15)',
  borderRadius: 30,
  padding: '34px 34px 30px',
  width: 'min(420px,92vw)',
  boxShadow: '0 22px 60px -10px rgba(0,0,0,0.35)',
  textAlign: 'center',
  fontFamily: 'Jost, sans-serif'
};
const overlayBtnPrimary = {
  background: '#2d2d2d',
  color: '#fff',
  border: 'none',
  padding: '10px 22px',
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
  padding: '10px 22px',
  borderRadius: 18,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13
};
