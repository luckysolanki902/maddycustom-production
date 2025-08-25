import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import CopyableCode from '@/components/utils/CopyableCode';
import connectToDb from '@/lib/middleware/connectToDb';
import B2BOrder from '@/models/B2BOrder';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function B2BConfirmationPage({ params }) {
  const { id } = await params;
  await connectToDb();
  let order;
  try {
    order = await B2BOrder.findById(id).lean();
  } catch (e) {
    return notFound();
  }
  if (!order) return notFound();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '50px 24px' }}>
      <h1 style={{ fontSize: 30, fontWeight: 600, color: '#2d2d2d', marginBottom: 8 }}>Request Received</h1>
      <p style={{ color: '#555', marginBottom: 30 }}>Your bulk purchase inquiry has been recorded. Our team will reach out soon.</p>
      <div style={{
        border: '1px solid #e5e5e5',
        background: '#fff',
        padding: 24,
        borderRadius: 12,
        marginBottom: 32
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2d2d2d', marginBottom: 12 }}>Inquiry Details</h2>
        <div style={{ fontSize: 14, color: '#333', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            <CopyableCode value={order._id.toString()} />
          <div><strong>Business:</strong> {order.businessName}</div>
          <div><strong>Contact:</strong> {order.contactName}</div>
          <div><strong>Email:</strong> {order.contactEmail}</div>
          <div><strong>Phone:</strong> {order.contactPhone}</div>
          <div><strong>Status:</strong> {order.status}</div>
          <div><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</div>
        </div>
        {order.notes && <p style={{ marginTop: 16, fontSize: 13, color: '#555' }}><strong>Notes:</strong> {order.notes}</p>}
      </div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2d2d2d', marginBottom: 12 }}>Items ({order.items.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.items.map(it => (
            <div key={it._id.toString()} style={{ display: 'flex', gap: 16, border: '1px solid #eee', background: '#fff', padding: 12, borderRadius: 8 }}>
              <div style={{ width: 60, height: 60, background: '#f5f5f5', borderRadius: 6, overflow: 'hidden', position:'relative' }}>
                <Image src={it.thumbnail?.startsWith('http') ? it.thumbnail : (process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL + it.thumbnail)} alt={it.name} fill sizes="60px" style={{ objectFit: 'cover' }} unoptimized={process.env.NODE_ENV==='development'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2d2d2d' }}>{it.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>SKU: {it.sku}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2d2d2d' }}>Qty: {it.quantity}</div>
            </div>
          ))}
        </div>
      </div>
  <Link href='/b2b' style={{ textDecoration: 'none', fontSize: 14, color: '#2d2d2d', fontWeight: 600 }}>← Back to B2B Home</Link>
    </main>
  );
}
