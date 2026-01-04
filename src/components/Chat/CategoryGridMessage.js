"use client";
import React from 'react';
/* eslint-disable @next/next/no-img-element */
import { motion } from 'framer-motion';

// Simple markdown bold renderer
function renderMarkdown(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function CategoryGridMessage({ title = 'Browse Categories', items = [], hint, summary }) {
  const safeItems = Array.isArray(items) ? items.slice(0, 12) : [];
  return (
    <div style={wrap}>
      <div style={heading}>{title}</div>
      {summary && <div style={summaryText}>{renderMarkdown(summary)}</div>}
      {safeItems.length === 0 ? (
        <div style={empty}>No categories available right now.</div>
      ) : (
        <div style={grid}>
          {safeItems.map((c) => (
            <motion.a key={(c.link || c.title) + (c.image || '')} href={c.link || '#'} whileHover={{ y: -2 }} style={card}>
              <div style={imgWrap}>{c.image ? <img src={c.image} alt={c.title || 'Category'} style={img} /> : <div style={imgSkeleton} />}</div>
              <div style={meta}><div style={name}>{c.title || 'Category'}</div></div>
            </motion.a>
          ))}
        </div>
      )}
      <div style={footerHint}>{hint || 'Tell me which category to open — for example, “Window Pillar Wrap” — and I’ll show matching products.'}</div>
    </div>
  );
}

const wrap = { background: '#f5f5f5', border: '1px solid rgba(45,45,45,0.15)', padding: '14px', borderRadius: 22, fontFamily: 'Jost, sans-serif', maxWidth: '100%' };
const heading = { fontSize: 13, fontWeight: 600, color: '#2d2d2d', marginBottom: 10 };
const empty = { fontSize: 12, color: 'rgba(45,45,45,0.65)' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, width: '100%' };
const card = { display: 'flex', flexDirection: 'column', textDecoration: 'none', background: '#fff', border: '1px solid rgba(45,45,45,0.12)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 16px -10px rgba(0,0,0,0.18)', color: '#2d2d2d' };
const imgWrap = { position: 'relative', width: '100%', paddingTop: '62%', overflow: 'hidden', background: '#eee' };
const img = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const imgSkeleton = { width: '100%', height: '100%', background: 'linear-gradient(90deg, #eee, #f5f5f5, #eee)', animation: 'pulse 1.2s ease-in-out infinite' };
const meta = { padding: '8px 10px' };
const name = { fontSize: 12, fontWeight: 600, lineHeight: 1.25 };
const footerHint = { marginTop: 10, fontSize: 12, color: 'rgba(45,45,45,0.7)' };
const summaryText = { fontSize: 13, color: 'rgba(45,45,45,0.85)', marginBottom: 10, lineHeight: 1.4 };
