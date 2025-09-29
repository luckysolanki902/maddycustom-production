"use client";
import React from 'react';

// Minimal inline SVG copy icon (Mui-like appearance without dependency)
const CopyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 1H4C2.9 1 2 1.9 2 3V15H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="#2d2d2d"/>
  </svg>
);

export default function OrderStatusMessage({ orderId, status, eta, trackUrl, steps = [], orderedAt, contactName, contactPhone, deliveryAddress }) {
  const normalizedStatus = (status || '').toString();
  const handleCopy = (txt) => navigator.clipboard?.writeText?.(txt);
  return (
    <div style={wrap}>
      <div style={sectionTitle}>Order Information</div>
      <div style={row}><div style={label}>Order ID</div><div style={valueMono}>
        {orderId}
        {orderId && (
          <button aria-label="Copy" title="Copy" onClick={() => handleCopy(orderId)} style={iconBtn}><CopyIcon /></button>
        )}
      </div></div>
      {orderedAt && <div style={row}><div style={label}>Ordered At</div><div style={value}>{formatDateTime(orderedAt)}</div></div>}
      <div style={row}><div style={label}>Status</div><div style={value}><span style={pill}>{normalizedStatus || '—'}</span></div></div>
      {deliveryAddress && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={label}>Delivery Address</div>
          <div style={value}>
            {contactName && <div style={{ fontWeight: 600, marginBottom: 4 }}>{contactName}</div>}
            <div style={{ whiteSpace: 'pre-wrap' }}>{deliveryAddress}</div>
          </div>
        </div>
      )}
      {(contactName || contactPhone) && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={label}>Contact Information</div>
          <div style={value}>
            {contactName && <div>{contactName}</div>}
            {contactPhone && (
              <div style={monoRow}>
                {contactPhone}
                <button aria-label="Copy" title="Copy" onClick={() => handleCopy(contactPhone)} style={iconBtn}><CopyIcon /></button>
              </div>
            )}
          </div>
        </div>
      )}
      {eta && (
        <div style={row}><div style={label}>ETA</div><div style={value}>{formatDate(eta)}</div></div>
      )}
      {/* Latest updates intentionally hidden as per request */}
      {trackUrl && (
        <a href={trackUrl} target="_blank" rel="noopener" style={ctaBtn}>View on Shiprocket</a>
      )}
    </div>
  );
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}
function formatDateTime(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return d; }
}

const wrap = { background: '#f5f5f5', border: '1px solid rgba(45,45,45,0.15)', padding: '14px 14px 16px', borderRadius: 22, fontFamily: 'Jost, sans-serif', maxWidth: 480 };
const sectionTitle = { fontSize: 14, fontWeight: 800, color: '#2d2d2d', marginBottom: 10 };
const row = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 };
const label = { width: 128, minWidth: 128, fontSize: 12, color: 'rgba(45,45,45,0.7)', fontWeight: 600 };
const value = { fontSize: 13, color: '#2d2d2d', fontWeight: 600 };
const monoRow = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'ui-monospace, monospace', fontSize: 12, background: 'rgba(45,45,45,0.06)', padding: '2px 6px', borderRadius: 8 };
const valueMono = { ...monoRow };
const iconBtn = { background: '#fff', border: '1px solid rgba(45,45,45,0.2)', borderRadius: 6, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const pill = { background: 'rgba(45,45,45,0.08)', color: '#2d2d2d', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800, textTransform: 'capitalize' };
const ctaBtn = { display: 'inline-block', marginTop: 6, background: '#2d2d2d', color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 12, fontWeight: 700, fontSize: 12, boxShadow: '0 6px 18px -6px rgba(0,0,0,0.35)' };
