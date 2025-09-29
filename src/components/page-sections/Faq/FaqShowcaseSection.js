'use client';
import React from 'react';
import { motion } from 'framer-motion';

// Minimal, automotive / rider vibe FAQ showcase (no accordions). Cards expand subtly on hover.
// Accepts: title (string), faqs [{title, content}]

export default function FaqShowcaseSection({ title = 'Frequently Asked Questions', faqs = [] }) {
  return (
    <section style={{ width: '100%', padding: '50px 0 90px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <header style={{ textAlign: 'center', marginBottom: 52 }}>
          <h1 style={{ margin: 0, fontSize: 54, letterSpacing: -1.2, fontWeight: 700, color: '#2d2d2d' }}>{title}</h1>
          <p style={{ margin: '16px auto 0', maxWidth: 760, fontSize: 18, lineHeight: 1.55, color: 'rgba(45,45,45,0.65)', fontWeight: 500 }}>
            Quick answers about wraps, fitment, care & orders. Chat bubble always there if you need deeper help.
          </p>
        </header>

        <div style={gridWrap}>
          {faqs.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, ease: [0.22, 0.68, 0, 0.96], delay: i * 0.04 }}
              whileHover={{ y: -6, boxShadow: '0 22px 44px -18px rgba(0,0,0,0.30)', borderColor: 'rgba(45,45,45,0.45)' }}
              style={{ ...card, '--i': i }}
            >
              <div style={tagRow}>
                <span style={numberBadge}>{String(i + 1).padStart(2, '0')}</span>
                <span style={microDot} />
                <span style={microDot} />
              </div>
              <h3 style={qTitle}>{f.title}</h3>
              <p style={answer}>{f.content}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const gridWrap = {
  display: 'grid',
  gap: 34,
  gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))'
};

const card = {
  position: 'relative',
  background: 'linear-gradient(145deg,#ffffff,#f7f7f7)',
  border: '1px solid rgba(45,45,45,0.28)',
  padding: '26px 24px 30px',
  borderRadius: 30,
  boxShadow: '0 14px 36px -14px rgba(0,0,0,0.25)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'border-color .35s, background .35s',
  cursor: 'default'
};

const tagRow = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 };
const numberBadge = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  padding: '6px 10px 6px',
  background: '#2d2d2d',
  color: '#fff',
  borderRadius: 12,
  boxShadow: '0 6px 22px -4px rgba(0,0,0,0.45)'
};
const microDot = {
  width: 6,
  height: 6,
  background: '#2d2d2d',
  borderRadius: '50%',
  opacity: 0.35
};
const qTitle = { fontSize: 18, margin: '0 0 12px', fontWeight: 600, letterSpacing: -0.3, color: '#2d2d2d' };
const answer = { fontSize: 13.2, lineHeight: 1.6, margin: 0, fontWeight: 500, color: 'rgba(45,45,45,0.70)' };
