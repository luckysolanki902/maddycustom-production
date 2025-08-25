'use client';
import React, { useCallback, useState } from 'react';
import Image from 'next/image';
import styles from '@/styles/home.module.css'; 
import { useDispatch, useSelector } from 'react-redux';
import { upsertB2BItem } from '@/store/slices/b2bSelectionSlice';
import dynamic from 'next/dynamic';

const ImageLightbox = dynamic(()=>import('../dialogs/ImageLightbox'), { ssr:false });

function getImage(product) {
  if (product.images?.length) return product.images[0];
  if (product.options?.length) {
    for (const opt of product.options) {
      if (opt.images?.length) return opt.images[0];
    }
  }
  return '/images/assets/gifs/helmetloadinggif.gif';
}

export default function ProductCardB2B({ product }) {
  const dispatch = useDispatch();
  const selectionItems = useSelector(s => s.b2bSelection.items);
  const imageBase = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const rawImg = getImage(product);
  // Normalize image path: ensure leading slash when concatenating base
  const img = rawImg?.startsWith('http') ? rawImg : (
    imageBase ? `${imageBase.replace(/\/$/, '')}${rawImg.startsWith('/') ? '' : '/'}${rawImg}` : rawImg
  );
  const selected = selectionItems.find(i => i.productId === product._id);
  const quantityNumber = selected?.quantity ?? 0;
  const quantity = String(quantityNumber);
  const sku = product.sku || product.options?.[0]?.sku || 'NA';

  const upsert = useCallback((q) => {
    dispatch(upsertB2BItem({
      productId: product._id,
      sku,
      name: product.name,
      quantity: q,
      thumbnail: img,
      category: product.category,
      subCategory: product.subCategory
    }));
  }, [dispatch, product._id, sku, product.name, img, product.category, product.subCategory]);

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    if (val === '') { upsert(0); return; }
    let parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) return; // ignore
    if (parsed > 100) parsed = 100; // cap
    upsert(parsed);
  };

  const increment = () => {
    const current = selected?.quantity ?? 0;
    const next = current + 1 > 100 ? 100 : current + 1;
    upsert(next);
  };
  const decrement = () => {
    const current = selected?.quantity || 0;
    const next = current - 1;
    upsert(next < 0 ? 0 : next);
  };

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div style={{
      border: '1px solid #e5e5e5',
      padding: 12,
      borderRadius: 10,
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 200,
      position: 'relative'
    }}>
      {quantityNumber > 0 && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: '#2d2d2d',
          color: '#fff',
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 20,
          fontWeight: 600,
          letterSpacing: '.5px',
          zIndex:888
        }}>{quantityNumber}</div>
      )}
      <div onClick={()=>setPreviewOpen(true)} title="Click to preview" style={{ position: 'relative', width: '100%', paddingTop: '70%', overflow: 'hidden', borderRadius: 14, background: '#f5f5f5', cursor:'zoom-in', boxShadow:'inset 0 4px 12px -6px rgba(0,0,0,0.18)' }}>
        <Image src={img} alt={product.name} fill style={{ objectFit: 'cover' }} unoptimized={process.env.NODE_ENV==='development'} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#2d2d2d' }}>{product.name}</div>
        <div style={{ fontSize: 12, color: '#666' }}>SKU: {sku}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type='button' onClick={decrement} style={{ background:'#f2f2f2', border:'1px solid #d0d0d0', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:18, lineHeight:1 }}>-</button>
          <input
            type='number'
            placeholder='Qty'
            value={quantity}
            min={0}
            max={100}
            onChange={handleQuantityChange}
            style={{
              border: '1px solid #ccc',
              padding: '6px 8px',
              borderRadius: 8,
              fontSize: 14,
              width: 70,
              textAlign: 'center'
            }}
          />
          <button type='button' onClick={increment} style={{ background:'#2d2d2d', color:'#fff', border:'1px solid #2d2d2d', width:34, height:34, borderRadius:8, cursor:'pointer', fontSize:18, lineHeight:1 }}>+</button>
        </div>
      </div>
      <ImageLightbox open={previewOpen} onClose={()=>setPreviewOpen(false)} src={img} alt={product.name} />
    </div>
  );
}
