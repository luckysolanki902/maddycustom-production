"use client";
import React from 'react';

// Minimal inline SVG copy icon (Mui-like appearance without dependency)
const CopyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 1H4C2.9 1 2 1.9 2 3V15H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="#2d2d2d"/>
  </svg>
);

export default function OrderStatusMessage({ 
  orderId, status, eta, trackUrl, steps = [], orderedAt, contactName, contactPhone, deliveryAddress,
  payment, items = [], paymentFailed, paymentPending, isMultiOrder, linkedOrders = []
}) {
  const normalizedStatus = (status || '').toString();
  const handleCopy = (txt) => navigator.clipboard?.writeText?.(txt);
  
  // Format currency
  const formatINR = (val) => {
    if (typeof val !== 'number') return null;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  // Payment pending - no order
  if (paymentPending) {
    return (
      <div style={wrap}>
        <div style={sectionTitle}>No Order Found</div>
        <div style={{ fontSize: 13, color: 'rgba(45,45,45,0.8)', marginBottom: 8 }}>
          No confirmed order found. The payment may not have been completed.
        </div>
        <div style={{ fontSize: 12, color: 'rgba(45,45,45,0.6)' }}>
          If you attempted to place an order, please try again or contact support.
        </div>
      </div>
    );
  }

  // Payment failed
  if (paymentFailed) {
    return (
      <div style={{ ...wrap, borderColor: 'rgba(220,53,69,0.3)' }}>
        <div style={{ ...sectionTitle, color: '#dc3545' }}>Payment Failed</div>
        {orderId && <div style={row}><div style={label}>Order ID</div><div style={valueMono}>{orderId}</div></div>}
        {orderedAt && <div style={row}><div style={label}>Attempted At</div><div style={value}>{formatDateTime(orderedAt)}</div></div>}
        {items.length > 0 && (
          <div style={{ ...row, alignItems: 'flex-start' }}>
            <div style={label}>Items</div>
            <div style={value}>
              {items.map((it, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  {it.name} × {it.quantity || 1} {it.price ? `— ${formatINR(it.price)}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        {payment && (
          <div style={row}><div style={label}>Amount</div><div style={value}>{formatINR(payment.finalAmount || payment.itemsTotal)}</div></div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(45,45,45,0.7)' }}>
          Please try placing a new order. If money was deducted, it will be refunded within 5-7 business days.
        </div>
      </div>
    );
  }

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
      <div style={row}><div style={label}>Delivery Status</div><div style={value}><span style={pill}>{normalizedStatus.toLowerCase() === 'unknown' ? 'Order has not shipped yet':
       normalizedStatus || 'Order not found'}</span></div></div>
      
      {/* Payment Status */}
      {payment && (
        <div style={row}>
          <div style={label}>Payment Status</div>
          <div style={value}>
            <span style={{
              ...pill,
              background: payment.status === 'allPaid' ? 'rgba(40,167,69,0.15)' : 
                         payment.status === 'failed' ? 'rgba(220,53,69,0.15)' : 'rgba(45,45,45,0.08)',
              color: payment.status === 'allPaid' ? '#28a745' : 
                     payment.status === 'failed' ? '#dc3545' : '#2d2d2d'
            }}>
              {payment.statusLabel || payment.status}
            </span>
          </div>
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={label}>Items ({items.length})</div>
          <div style={value}>
            {items.slice(0, 3).map((it, i) => (
              <div key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                {it.name} × {it.quantity || 1}
              </div>
            ))}
            {items.length > 3 && <div style={{ fontSize: 11, color: 'rgba(45,45,45,0.5)' }}>+{items.length - 3} more</div>}
          </div>
        </div>
      )}

      {/* Amount Breakdown */}
      {payment && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={label}>Amount</div>
          <div style={value}>
            <div style={{ fontWeight: 700 }}>{formatINR(payment.finalAmount || payment.itemsTotal)}</div>
            {payment.couponDiscount > 0 && <div style={{ fontSize: 11, color: '#28a745' }}>Discount: -{formatINR(payment.couponDiscount)}</div>}
            {payment.walletUsed > 0 && <div style={{ fontSize: 11, color: '#28a745' }}>Wallet: -{formatINR(payment.walletUsed)}</div>}
            {payment.shippingCharges > 0 && <div style={{ fontSize: 11, color: 'rgba(45,45,45,0.6)' }}>Shipping: +{formatINR(payment.shippingCharges)}</div>}
            {/* Paid/Due breakdown */}
            {payment.amountPaidOnline > 0 && (
              <div style={{ fontSize: 11, color: '#28a745', marginTop: 4 }}>Paid Online: {formatINR(payment.amountPaidOnline)}</div>
            )}
            {payment.amountDueCod > 0 && (
              <div style={{ fontSize: 11, color: '#dc3545' }}>Due (COD): {formatINR(payment.amountDueCod)}</div>
            )}
            {payment.amountPaidCod > 0 && (
              <div style={{ fontSize: 11, color: '#28a745' }}>Paid (COD): {formatINR(payment.amountPaidCod)}</div>
            )}
          </div>
        </div>
      )}

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
          <div style={label}>Contact</div>
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
      {trackUrl && (
        <a href={trackUrl} target="_blank" rel="noopener" style={ctaBtn}>View on Shiprocket</a>
      )}
      
      {/* Linked Orders (Multiple Shipments) */}
      {isMultiOrder && linkedOrders?.length > 0 && (
        <div style={linkedOrdersSection}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d2d2d', marginBottom: 8 }}>
            Related Shipments ({linkedOrders.length + 1} total)
          </div>
          {linkedOrders.map((linked, i) => (
            <div key={linked.orderId || i} style={linkedOrderCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'rgba(45,45,45,0.7)' }}>
                  {linked.orderId?.slice(-8) || `Order ${i + 2}`}
                </span>
                <span style={{
                  ...linkedPill,
                  background: linked.status === 'delivered' ? 'rgba(40,167,69,0.15)' : 'rgba(45,45,45,0.08)',
                  color: linked.status === 'delivered' ? '#28a745' : '#2d2d2d'
                }}>
                  {linked.status || 'Pending'}
                </span>
              </div>
              {linked.items?.length > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(45,45,45,0.6)' }}>
                  {linked.items.slice(0, 2).map(it => it.name).join(', ')}
                  {linked.items.length > 2 && ` +${linked.items.length - 2} more`}
                </div>
              )}
              {linked.trackUrl && (
                <a href={linked.trackUrl} target="_blank" rel="noopener" style={{ ...linkedTrackLink, marginTop: 4 }}>Track →</a>
              )}
            </div>
          ))}
        </div>
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
const linkedOrdersSection = { marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(45,45,45,0.15)' };
const linkedOrderCard = { background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(45,45,45,0.1)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 };
const linkedPill = { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' };
const linkedTrackLink = { display: 'inline-block', fontSize: 11, color: '#2d2d2d', fontWeight: 600, textDecoration: 'underline' };
