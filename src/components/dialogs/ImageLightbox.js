"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

// Fullscreen image lightbox with glassy backdrop & smooth animation
export default function ImageLightbox({ open, onClose, src, alt }) {
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);
  useEffect(()=>{
    if(!open) return; const h = (e)=>{ if(e.key==='Escape') onClose?.(); };
    window.addEventListener('keydown', h); return ()=>window.removeEventListener('keydown', h);
  },[open,onClose]);
  if(!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true"
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          transition={{duration:.35}}
          onClick={onClose}
          style={{position:'fixed', inset:0, zIndex:1300, background:'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.08), rgba(0,0,0,0.85)), rgba(0,0,0,0.78)', backdropFilter:'blur(12px) saturate(160%)', WebkitBackdropFilter:'blur(12px) saturate(160%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'4vh 4vw'}}>
          <motion.div initial={{scale:.9, y:25, opacity:0}} animate={{scale:1, y:0, opacity:1}} exit={{scale:.9, y:10, opacity:0}} transition={{type:'spring', stiffness:200, damping:20}}
            style={{position:'relative', width:'85vw', height:'80vh', maxWidth:'1400px', maxHeight:'90vh', borderRadius:28, overflow:'hidden', boxShadow:'0 28px 70px -18px rgba(0,0,0,0.55), 0 4px 20px -2px rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0e0e0f,#1f2022)'}} onClick={e=>e.stopPropagation()}>
            {src ? (
              <Image src={src} alt={alt||'Preview'} fill sizes="(max-width: 768px) 100vw, 80vw" style={{objectFit:'contain'}} unoptimized={process.env.NODE_ENV==='development'} priority />
            ) : null}
            <button onClick={onClose} aria-label="Close image preview" style={{position:'absolute', top:10, right:10, background:'rgba(0,0,0,0.55)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', padding:'6px 13px', fontSize:12, borderRadius:30, cursor:'pointer', fontWeight:600, letterSpacing:'.5px', backdropFilter:'blur(4px)'}}>
              Close ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>, document.body);
}
