"use client";
import React from 'react';
import { motion } from 'framer-motion';

export default function ProductGalleryMessage({
	products = [],
	summary,
	hasMore,
	onShowMore,
	pending
}) {
  if (!products.length) {
    return (
      <div style={wrapperStyle}>No products found.</div>
    );
  }
  return (
    <div style={wrapperStyle}>
      <div style={titleRow}>Suggested Products</div>
      <div style={summaryStyle}>{"Here are the best picks for you! To make your choice easier, we've curated a list of products that match your preferences."}  </div>
      <div style={gridStyle}>
        {products.map(p => (
          <motion.a
            key={p.slug + p.title}
            href={p.slug}
            whileHover={{ y: -4 }}
            style={cardStyle}
          >
            {p.image && (
              <div style={imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} style={imgStyle} />
                {p.discountPercent > 0 && <div style={discountBadge}>-{p.discountPercent}%</div>}
              </div>
            )}
            <div style={infoStyle}>
              <div style={prodTitle}>{p.title}</div>
              <div style={priceRow}>
                <span style={finalPrice}>₹{p.price}</span>
                {p.mrp && p.mrp > p.price && <span style={mrpStyle}>₹{p.mrp}</span>}
              </div>
            </div>
          </motion.a>
        ))}
      </div>
      {hasMore && (
        <div style={footerRow}>
          <button onClick={onShowMore} disabled={pending} style={{ ...moreBtnStyle, opacity: pending ? 0.6 : 1 }}>
            {pending ? 'Fetching…' : 'Show more ideas'}
          </button>
        </div>
      )}
    </div>
  );
}

const wrapperStyle = {
  background: '#f5f5f5',
  border: '1px solid rgba(45,45,45,0.15)',
  padding: '14px 14px 18px',
  borderRadius: 22,
  fontFamily: 'Jost, sans-serif',
  maxWidth: '100%'
};
const titleRow = { fontSize: 13, fontWeight: 600, color: '#2d2d2d', marginBottom: 10 };
const summaryStyle = { fontSize: 12, lineHeight: 1.6, color: 'rgba(45,45,45,0.78)', marginBottom: 14, fontWeight: 500 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, width: '100%' };
const cardStyle = {
  textDecoration: 'none',
  background: '#fff',
  border: '1px solid rgba(45,45,45,0.12)',
  borderRadius: 18,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 6px 18px -6px rgba(0,0,0,0.12)',
  position: 'relative'
};
const imageWrap = { position: 'relative', width: '100%', paddingTop: '66%', overflow: 'hidden' };
const imgStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const discountBadge = {
  position: 'absolute', top: 6, left: 6, background: '#2d2d2d', color: '#fff', fontSize: 10,
  padding: '4px 8px', borderRadius: 12, fontWeight: 600, letterSpacing: 0.5
};
const infoStyle = { padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 };
const prodTitle = { fontSize: 12, fontWeight: 600, color: '#2d2d2d', lineHeight: 1.3, minHeight: 30 };
const priceRow = { display: 'flex', alignItems: 'center', gap: 6 };
const finalPrice = { fontSize: 13, fontWeight: 700, color: '#2d2d2d' };
const mrpStyle = { fontSize: 11, textDecoration: 'line-through', opacity: 0.6 };
const footerRow = { marginTop: 16, display: 'flex', justifyContent: 'flex-start' };
const moreBtnStyle = {
  border: '1px solid rgba(45,45,45,0.2)',
  background: '#fff',
  color: '#2d2d2d',
  padding: '8px 14px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 6px 18px -8px rgba(0,0,0,0.18)'
};
