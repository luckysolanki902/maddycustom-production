"use client";
import React, { useState, useCallback } from 'react';

// Reusable copy-to-clipboard code pill with subtle feedback
export default function CopyableCode({ value, label='ID' }) {
  const [copied,setCopied] = useState(false);
  const doCopy = useCallback(()=>{
    if(!value) return;
    navigator?.clipboard?.writeText(value).then(()=>{
      setCopied(true); setTimeout(()=>setCopied(false),1400);
    });
  },[value]);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <strong>{label}:</strong>
      <code onClick={doCopy} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter' || e.key===' ') {e.preventDefault(); doCopy();}}}
        style={{background: copied? '#0f6' : '#1e1e1e', transition:'background .35s', color:'#fff', padding:'6px 10px', borderRadius:6, fontSize:12, letterSpacing:'.5px', cursor:'pointer', userSelect:'all', outline:'none'}}>
        {value}
      </code>
      <span style={{fontSize:10, color: copied? '#0a4' : '#777'}}>{copied? 'Copied!' : 'Tap to copy'}</span>
    </div>
  );
}
