"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useChatSession } from './ChatSessionContext';
import ProductGalleryMessage from './ProductGalleryMessage';
import OrderStatusMessage from './OrderStatusMessage';
import CategoryGridMessage from './CategoryGridMessage';
import { v4 as uuidv4 } from 'uuid';

export default function FullPageSupportChat() {
	const { messages, loading, pendingAssistant, loadingHistory, isResetting, sendMessage, resetChat, retryLast, invokeProductSearch } = useChatSession() || {};
	const [input, setInput] = useState('');
	const [showTemplates, setShowTemplates] = useState(messages?.length === 0);
	const containerRef = useRef(null);
	useEffect(() => {
		if (!containerRef.current || !messages?.length) return;
		const last = messages[messages.length - 1];
		if (last?.type !== 'product_gallery') {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [messages, loading]);

	const templates = ['Suggest best pillar wraps','Find under 1000 accessories','Installation tips','Order tracking help'];

	const handleSend = useCallback(() => {
		if (!input.trim()) return; sendMessage(input); setInput(''); setShowTemplates(false);
	}, [input, sendMessage]);
	const handleTemplate = t => { sendMessage(t); setShowTemplates(false); };

	const [confirmOpen, setConfirmOpen] = useState(false);
	const openReset = () => { if (!messages) return; if (messages.length < 1) { resetChat(); setShowTemplates(true); } else setConfirmOpen(true); };
	const doReset = async () => { await resetChat(); setShowTemplates(true); setConfirmOpen(false); };

	if (!messages) return null;

	return (
		<div style={outerWrap}>
			<div style={panelStyle}>
				<div style={panelHeader}>
					<div style={avatarStyle}>MD</div>
					<div style={{ flex: 1 }}>
						<div style={panelTitle}>MaddyCustom Support</div>
						<div style={panelSub}>{isResetting ? 'Starting a new chat…' : (loadingHistory ? 'Loading conversation…' : 'We can recommend products & track orders')}</div>
					</div>
					<button onClick={openReset} title="New chat" style={{...iconBtnLarge, opacity: isResetting ? 0.55 : 1, pointerEvents: isResetting ? 'none' : 'auto'}}>{isResetting ? '…' : '↺'}</button>
				</div>
        {isResetting && (<motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror' }} style={{ height: 3, background: '#2d2d2d' }} />)}
				<div ref={containerRef} style={scrollRegion}>
					{messages.length === 0 && !loadingHistory && (
						<div style={introBlock}>
							<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, color: '#2d2d2d' }}>How can we help?</div>
							<div style={{ fontSize: 14, color: 'rgba(45,45,45,0.65)', marginBottom: 18 }}>{isResetting ? 'Setting things up…' : 'Ask about wraps, availability, shipping, or let us suggest items.'}</div>
							{showTemplates && (
								<div style={templateFlex}>
									{templates.map(t => (
										<motion.button key={t} whileTap={{ scale: 0.94 }} disabled={isResetting} onClick={() => handleTemplate(t)} style={{...templateBtn, opacity: isResetting ? 0.55 : 1}}>{t}</motion.button>
									))}
								</div>
							)}
						</div>
					)}
					{messages.map(m => {
						if (m.type === 'category_grid') {
							return (
								<div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20 }}>
									<CategoryGridMessage title={m.title} items={m.items} hint={m.hint} />
								</div>
							);
						}
						if (m.type === 'product_gallery') {
							return (
								<div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20 }}>
									<ProductGalleryMessage
										products={m.products}
										hasMore={m.hasMore}
										pending={pendingAssistant}
										onShowMore={() => invokeProductSearch({
											query: m.queryEcho?.query,
											maxPrice: m.queryEcho?.maxPrice,
											minPrice: m.queryEcho?.minPrice,
											keywords: m.queryEcho?.keywords,
											page: (m.page || 1) + 1,
											limit: m.limit || 8
										})}
									/>
								</div>
							);
						}
						if (m.type === 'order_status') {
							return (
								<div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20 }}>
									<OrderStatusMessage orderId={m.orderId} status={m.status} eta={m.eta} trackUrl={m.trackUrl} steps={m.steps} orderedAt={m.orderedAt} contactName={m.contactName} contactPhone={m.contactPhone} deliveryAddress={m.deliveryAddress} />
								</div>
							);
						}
						return (
							<motion.div key={m.id || uuidv4()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 20 }}>
								<div style={m.role === 'user' ? userBubble : botBubble}>
									<div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{formatText(m.text)}</div>
									<div style={timestamp}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
								</div>
							</motion.div>
						);
					})}
					{pendingAssistant && <div style={botBubble}><div style={{ fontSize: 13, color: 'rgba(45,45,45,0.65)', marginBottom: 6 }}>Working on it…</div>…</div>}
				</div>
				<div style={inputFooter}>
					<div style={{ display: 'flex', gap: 14 }}>
						<textarea
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
							placeholder="Type your message..."
							style={{...textInput, opacity: isResetting ? 0.6 : 1}}
							rows={1}
						/>
						<motion.button whileTap={{ scale: 0.94 }} disabled={!input.trim() || loading || pendingAssistant || isResetting} onClick={handleSend} style={{ ...sendBtnLarge, opacity: (!input.trim() || loading || pendingAssistant || isResetting) ? 0.55 : 1 }}>{(loading || pendingAssistant || isResetting) ? '...' : 'Send'}</motion.button>
					</div>
					{messages.length > 0 && messages[messages.length - 1].meta?.error && (
						<div style={{ marginTop: 12, textAlign: 'center' }}>
							<button onClick={retryLast} style={retryBtn}>Retry</button>
						</div>
					)}
				</div>
			</div>
			{confirmOpen && (
				<div style={overlayWrap}>
					<div style={overlayCard}>
						<div style={{ fontSize: 20, fontWeight: 600, color: '#2d2d2d', marginBottom: 12 }}>Start New Chat?</div>
						<div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(45,45,45,0.70)', fontWeight: 500, marginBottom: 22 }}>This clears only local messages. Server history is retained for quality.</div>
						<div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
							<button onClick={() => setConfirmOpen(false)} style={{...overlayBtnSecondary, opacity: isResetting ? 0.6 : 1}} disabled={isResetting}>Cancel</button>
							<button onClick={doReset} style={{...overlayBtnPrimary, opacity: isResetting ? 0.6 : 1}} disabled={isResetting}>{isResetting ? 'Starting…' : 'Start Fresh'}</button>
						</div>
					</div>
					{isResetting && (
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3500 }}>
							<motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(45,45,45,0.16)', borderRadius: 24, padding: '20px 22px', boxShadow: '0 26px 72px -14px rgba(0,0,0,0.35)' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
									<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} style={{ width: 22, height: 22, border: '2px solid rgba(45,45,45,0.35)', borderTopColor: '#2d2d2d', borderRadius: '50%' }} />
									<div style={{ fontSize: 14, color: '#2d2d2d', fontWeight: 600 }}>Starting a new chat…</div>
								</div>
								<motion.div initial={{ width: '10%' }} animate={{ width: '100%' }} transition={{ repeat: Infinity, repeatType: 'mirror', duration: 1.6 }} style={{ height: 3, background: '#2d2d2d', marginTop: 10, borderRadius: 2 }} />
							</motion.div>
						</motion.div>
					)}
				</div>
			)}
		</div>
	);
}

const outerWrap = { padding: '40px 40px 70px', maxWidth: 1380, margin: '0 auto', fontFamily: 'Jost, sans-serif' };
const panelStyle = { border: '1px solid rgba(45,45,45,0.12)', borderRadius: 40, minHeight: '68vh', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 30px 80px -18px rgba(0,0,0,0.28)', overflow: 'hidden' };
const panelHeader = { padding: '22px 30px 18px', display: 'flex', alignItems: 'center', gap: 18, borderBottom: '1px solid rgba(45,45,45,0.08)', background: 'linear-gradient(120deg,#ffffff,#f5f5f5)' };
const avatarStyle = { width: 56, height: 56, borderRadius: 20, background: '#2d2d2d', color: '#fff', fontWeight: 600, fontSize: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', letterSpacing: 0.5 };
const panelTitle = { fontSize: 20, fontWeight: 600, color: '#2d2d2d' };
const panelSub = { fontSize: 13, color: 'rgba(45,45,45,0.55)', fontWeight: 500 };
const scrollRegion = { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '28px 32px 24px', background: 'radial-gradient(circle at 85% 8%, rgba(45,45,45,0.04), transparent 70%)' };
const introBlock = { textAlign: 'center', marginTop: 20 };
const templateFlex = { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' };
const templateBtn = { background: '#ffffff', border: '1px solid rgba(45,45,45,0.15)', padding: '10px 14px', borderRadius: 18, fontSize: 13, cursor: 'pointer', fontWeight: 500, color: '#2d2d2d', boxShadow: '0 6px 16px -6px rgba(0,0,0,0.08)' };
const baseBubble = { padding: '14px 18px 18px', borderRadius: 26, maxWidth: '68%', fontSize: 15, lineHeight: 1.55, position: 'relative', fontWeight: 500, letterSpacing: 0.25, boxShadow: '0 10px 34px -14px rgba(0,0,0,0.25)' };
const userBubble = { ...baseBubble, background: '#2d2d2d', color: '#fff', borderBottomRightRadius: 10 };
const botBubble = { ...baseBubble, background: '#f5f5f5', color: '#2d2d2d', borderBottomLeftRadius: 10 };
const timestamp = { fontSize: 11, opacity: 0.55, marginTop: 8, textAlign: 'right' };
const inputFooter = { padding: '20px 30px 26px', borderTop: '1px solid rgba(45,45,45,0.08)', background: '#fff' };
const textInput = { flex: 1, resize: 'none', border: '1px solid rgba(45,45,45,0.20)', borderRadius: 22, padding: '14px 18px', outline: 'none', fontFamily: 'inherit', fontSize: 15, background: '#fff', color: '#2d2d2d', fontWeight: 500, boxShadow: '0 8px 26px -12px rgba(0,0,0,0.12)' };
const sendBtnLarge = { background: '#2d2d2d', color: '#fff', border: 'none', borderRadius: 22, padding: '0 32px', cursor: 'pointer', fontWeight: 600, fontSize: 15, letterSpacing: 0.4, boxShadow: '0 12px 38px -14px rgba(0,0,0,0.55)' };
const iconBtnLarge = { background: 'rgba(45,45,45,0.06)', border: '1px solid rgba(45,45,45,0.15)', color: '#2d2d2d', width: 46, height: 46, borderRadius: 16, cursor: 'pointer', fontSize: 22, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const retryBtn = { background: '#2d2d2d', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 16, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const overlayWrap = { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3500, padding: 30 };
const overlayCard = { background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(45,45,45,0.15)', borderRadius: 34, padding: '34px 38px 30px', width: 'min(480px,92vw)', boxShadow: '0 26px 72px -14px rgba(0,0,0,0.45)', textAlign: 'center', fontFamily: 'Jost, sans-serif' };
const overlayBtnPrimary = { background: '#2d2d2d', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 14, letterSpacing: 0.4, boxShadow: '0 8px 26px -8px rgba(0,0,0,0.5)' };
const overlayBtnSecondary = { background: 'rgba(45,45,45,0.08)', color: '#2d2d2d', border: '1px solid rgba(45,45,45,0.25)', padding: '12px 24px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 14 };

// Regex formatter shared with dialog
function formatText(txt) {
	if (!txt) return '';
	let html = txt
		.replace(/\b([a-f0-9]{24})\b/gi, '<span class="mc-copyable" data-copy="$1" style="font-family: ui-monospace, monospace; background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 8px;">$1 <button class="mc-copy-btn" data-copy="$1" style="margin-left:6px; font-size:10px; padding:2px 6px; border:1px solid rgba(45,45,45,0.2); border-radius:6px; background:#fff; cursor:pointer;">Copy<\/button><\/span>')
		.replace(/\b(delivered|shipped|in transit|out for delivery|cancelled|returned|rto)\b/gi, '<strong style="color:#2d2d2d; background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px; text-transform: capitalize;">$1</strong>')
		.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" rel="noopener" style="color:#2d2d2d; text-decoration: underline;">$1<\/a>')
		// ISO dates YYYY-MM-DD or YYYY/MM/DD
		.replace(/\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/g, '<span style="background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px;">$1<\/span>')
		// Common Indian format DD/MM/YYYY or DD-MM-YYYY
		.replace(/\b(\d{2}[\/-]\d{2}[\/-]\d{4})\b/g, '<span style="background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px;">$1<\/span>')
		// Indian phone numbers: 10 digits (optionally prefixed by +91 or 0)
		.replace(/\b(?:\+91[-\s]?)?([6-9]\d{9})\b/g, '<span class="mc-copyable" data-copy="$1" style="background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px;">$1 <button class="mc-copy-btn" data-copy="$1" style="margin-left:6px; font-size:10px; padding:2px 6px; border:1px solid rgba(45,45,45,0.2); border-radius:6px; background:#fff; cursor:pointer;">Copy<\/button><\/span>');
	// Convert bullet points
	if (/^(?:\s*[•\-*]\s+.+)$/m.test(txt)) {
		html = html.replace(/^(\s*[•\-*]\s+.+)$/gm, '<li>$1<\/li>')
				   .replace(/<li>\s*[•\-*]\s+/g, '<li>');
		html = `<ul style=\"margin:6px 0 6px 16px; padding:0; list-style:disc;\">${html}<\/ul>`;
	}
	// Convert ordered lists
	if (/^(\s*\d+\.\s+.+)$/m.test(txt)) {
		html = html.replace(/^(\s*\d+\.\s+.+)$/gm, '<li>$1<\/li>')
				   .replace(/<li>\s*\d+\.\s+/g, '<li>');
		html = `<ol style=\"margin:6px 0 6px 16px; padding:0; list-style:decimal;\">${html}<\/ol>`;
	}
	const onClick = (e) => {
		const t = e.target;
		if (t && t.classList && t.classList.contains('mc-copy-btn')) {
			const text = t.getAttribute('data-copy');
			if (text) navigator.clipboard?.writeText(text);
		}
	};
	return <span onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
