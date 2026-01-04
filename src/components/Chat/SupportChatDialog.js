"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatSession } from './ChatSessionContext';
import ProductGalleryMessage from './ProductGalleryMessage';
import OrderStatusMessage from './OrderStatusMessage';
import CategoryGridMessage from './CategoryGridMessage';
import { v4 as uuidv4 } from 'uuid';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const LoaderSpinner = ({ size = 18 }) => (
	<motion.div
		animate={{ rotate: 360 }}
		transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
		style={{ width: size, height: size, borderRadius: '50%', border: '2px solid rgba(45,45,45,0.2)', borderTopColor: '#2d2d2d' }}
	/>
);

const LoaderGlow = () => (
	<motion.span
		animate={{ opacity: [0.35, 0.9, 0.35], scale: [1, 1.25, 1] }}
		transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
		style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(45,45,45,0.6)', boxShadow: '0 0 12px rgba(45,45,45,0.35)' }}
	/>
);

// Skeleton component for chat bubbles
const SkeletonBubble = ({ align = 'left', width = '60%', delay = 0 }) => (
	<motion.div
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ delay, duration: 0.3 }}
		style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', marginBottom: 14 }}
	>
		<motion.div
			animate={{ opacity: [0.3, 0.6, 0.3] }}
			transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay }}
			style={{
				width,
				height: 48,
				borderRadius: 22,
				background: align === 'right' 
					? 'linear-gradient(90deg, rgba(45,45,45,0.15), rgba(45,45,45,0.08))' 
					: 'linear-gradient(90deg, rgba(45,45,45,0.08), rgba(45,45,45,0.04))',
				borderBottomRightRadius: align === 'right' ? 8 : 22,
				borderBottomLeftRadius: align === 'left' ? 8 : 22,
			}}
		/>
	</motion.div>
);

const ResetOverlay = ({ visible, phrase }) => {
	if (!visible) return null;
	return (
<></>
	);
};

const loadingPhrases = {
	order: [
		'Gathering the latest courier updates…',
	],
	products: [
		'Picking products that match your vibes…',
	],
	categories: [
		'Fetching all the categories…',
	],
	answer: [
		'Working on it…',
	],
	default: [
		'Working on it…',
	],
	reset: [
		'Setting up a clean chat…',
	]
};
const templateSets = {
	home: [
		'My car is red and my budget is 1000',
		'Find some stylish wraps for my bike',
		'Track my order with my phone number',
		'Suggest something for car interiors',
		'Show anime-inspired pillar wraps'
	],
	productDetail: [
		'Show me products of similar design',
		'Pair a black accent with my blue car for 900?',
		'Is there any return policy?',
		'My car is red and my budget is 1000',
		'Find some stylish wraps for my bike',
		'Track my order with my phone number',
		'Suggest something for car interiors',
		'Show anime-inspired pillar wraps'
	],
	orderSuccess: [
		'Track my order using my order Id',
		'How to install the wrap',
		'My car is red and my budget is 1000',
		'Find some stylish wraps for my bike',
		'Track my order with my phone number',
		'Suggest something for car interiors',
		'Show anime-inspired pillar wraps'
	],
	fallback: [
		'My car is red and my budget is 1000',
		'Find some stylish wraps for my bike',
		'Track my order with my phone number',
		'Suggest something for car interiors',
		'Show anime-inspired pillar wraps'
	]
};

export default function SupportChatDialog({ open, onClose, initialQuery }) {
	const pathname = usePathname();
	const { isCartDrawerOpen, isSidebarOpen, isSearchDialogOpen } = useSelector(s => s.ui);
	const hidden = isCartDrawerOpen || isSidebarOpen || isSearchDialogOpen;

	const { messages, loadingHistory, pendingAssistant, pendingDescriptor, isResetting, retryLast, sendMessage, resetChat, invokeProductSearch, needsResolutionCheck, submitResolution, awaitingPhone, pendingPhone, setPendingPhone, submitPhone } = useChatSession() || {};

	const [input, setInput] = useState('');
	const [showTemplates, setShowTemplates] = useState(true);
	const [loaderPhrase, setLoaderPhrase] = useState('');
	const [resetPhrase, setResetPhrase] = useState(loadingPhrases.reset[0]);
	const initialQueryHandledRef = useRef(false);
	const routeType = useMemo(() => {
		if (!pathname) return 'fallback';
		if (pathname === '/') return 'home';
		if (pathname === '/faqs') return 'faq';
		if (/^\/orders\/myorder\//.test(pathname)) return 'orderSuccess';
		if (pathname.startsWith('/shop')) {
			const parts = pathname.split('/').filter(Boolean);
			if (parts.length === 1 + 4) return 'productList';
			if (parts.length === 1 + 5) return 'productDetail';
			return 'productList';
		}
		return 'fallback';
	}, [pathname]);
	const initialTemplates = templateSets[routeType] || templateSets.fallback;

	// Handle initial query from search dialog
	useEffect(() => {
		if (open && initialQuery && !initialQueryHandledRef.current && sendMessage && !loadingHistory) {
			initialQueryHandledRef.current = true;
			setShowTemplates(false);
			// Small delay to let the dialog open animation complete
			setTimeout(() => {
				sendMessage(initialQuery);
			}, 300);
		}
		// Reset the flag when dialog closes
		if (!open) {
			initialQueryHandledRef.current = false;
		}
	}, [open, initialQuery, sendMessage, loadingHistory]);

	// Broadcast open/close so other UI (e.g., FloatingActionBar) can hide while dialog is open
	useEffect(() => {
		try {
			const ev = new CustomEvent('mc-chat-dialog-visibility', { detail: { open: !!open } });
			window.dispatchEvent(ev);
		} catch { }
	}, [open]);

	const containerRef = useRef(null);
	// Auto-scroll only when the latest message is from user or a non-gallery type
	useEffect(() => {
		if (!containerRef.current || !messages?.length) return;
		const last = messages[messages.length - 1];
		if (last?.type !== 'product_gallery') {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [messages, pendingAssistant]);

	useEffect(() => {
		if (!pendingAssistant) {
			setLoaderPhrase('');
			return;
		}
		const key = pendingDescriptor && loadingPhrases[pendingDescriptor] ? pendingDescriptor : 'default';
		const list = (loadingPhrases[key] && loadingPhrases[key].length) ? loadingPhrases[key] : loadingPhrases.default;
		let idx = 0;
		setLoaderPhrase(list[idx]);
		const interval = setInterval(() => {
			idx = (idx + 1) % list.length;
			setLoaderPhrase(list[idx]);
		}, 2600);
		return () => clearInterval(interval);
	}, [pendingAssistant, pendingDescriptor]);

	useEffect(() => {
		if (!isResetting) return;
		const list = loadingPhrases.reset.length ? loadingPhrases.reset : loadingPhrases.default;
		let idx = 0;
		setResetPhrase(list[idx]);
		const interval = setInterval(() => {
			idx = (idx + 1) % list.length;
			setResetPhrase(list[idx]);
		}, 3000);
		return () => clearInterval(interval);
	}, [isResetting]);

	const handleSend = useCallback(() => {
		if (!input.trim()) return;
		sendMessage(input);
		setInput('');
		setShowTemplates(false);
	}, [input, sendMessage]);
	const handleTemplate = t => { sendMessage(t); setShowTemplates(false); };

	// Instant new chat - no confirmation dialog, immediately clear and show skeletons
	const handleNewChatClick = () => {
		resetChat?.();
		setShowTemplates(true);
	};

	if (!open || hidden) return null;
	if (!messages) return null;

	return (
		<AnimatePresence>
			<motion.div
				key="support-chat"
				initial={{ opacity: 0, scale: 0.9, y: 20 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.92, y: 10 }}
				transition={{ type: 'spring', stiffness: 220, damping: 22 }}
				style={{ ...rootStyle, position: 'fixed' }}
			>
				<div style={headerStyle}>
					<div style={avatar}>MD</div>
					<div style={{ flex: 1 }}>
						<div style={titleStyle}>MaddyCustom Support</div>
						<div style={subtitleStyle}>{isResetting ? 'Starting a new chat…' : (loadingHistory ? 'Loading conversation…' : 'Ask anything about your order, wraps & accessories')}</div>
					</div>
					<button onClick={handleNewChatClick} title="Clear chat" style={{ ...iconBtnStyle, opacity: isResetting ? 0.5 : 1, pointerEvents: isResetting ? 'none' : 'auto' }}>
						<DeleteOutlineIcon sx={{ fontSize: 18 }} />
					</button>
					<button onClick={onClose} title="Close" style={iconBtnStyle}>×</button>
				</div>
				{/* Thin animated loading bar under header while resetting */}
				{isResetting && (
					<motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror' }} style={{ height: 2, background: '#2d2d2d' }} />
				)}
				<div ref={containerRef} style={messagesContainer}>
					{messages.length === 0 && !loadingHistory && (
						<div style={emptyIntro}> <div style={{ fontWeight: 600, marginBottom: 10, color: '#2d2d2d' }}>Welcome Rider 👋</div>
							<div style={{ marginBottom: 16 }}>{isResetting ? 'Setting things up…' : 'Pick a quick question or type your own to get started.'}</div>
							{showTemplates && (
								<div style={templatesWrap}>
									{initialTemplates.map(t => (
										<motion.button key={t} whileTap={{ scale: 0.94 }} disabled={isResetting} onClick={() => handleTemplate(t)} style={{ ...templateBtnStyle, opacity: isResetting ? 0.5 : 1 }}>{t}</motion.button>
									))}
								</div>
							)}
						</div>
					)}
					{messages.map(m => {
						if (m.type === 'category_grid') {
							return (
								<div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
									<CategoryGridMessage title={m.title} items={m.items} hint={m.hint} summary={m.summary} />
								</div>
							);
						}
						if (m.type === 'product_gallery') {
							return (
								<div key={m.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
									<ProductGalleryMessage
										products={m.products}
										summary={m.summary}
										hasMore={m.hasMore}
										pending={pendingAssistant}
										onShowMore={() => invokeProductSearch({
											query: m.queryEcho?.query,
											maxPrice: m.queryEcho?.maxPrice,
											minPrice: m.queryEcho?.minPrice,
											keywords: m.queryEcho?.keywords,
											categoryTitle: m.queryEcho?.categoryTitle,
											classificationTags: m.queryEcho?.classificationTags,
											excludeTags: m.queryEcho?.excludeTags,
											diversifyCategories: m.queryEcho?.diversifyCategories,
											page: (m.queryEcho?.page || 1) + 1,
											limit: m.limit || 6
										})}
									/>
								</div>
							);
						}
						if (m.type === 'order_status') {
							// Check if this is the last order_status message and needs resolution check
							const isLastOrderStatus = needsResolutionCheck && 
								messages.filter(msg => msg.type === 'order_status').slice(-1)[0]?.id === m.id;
							return (
								<div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 14 }}>
									<OrderStatusMessage 
										orderId={m.orderId} 
										status={m.status} 
										eta={m.eta} 
										trackUrl={m.trackUrl} 
										steps={m.steps} 
										orderedAt={m.orderedAt} 
										contactName={m.contactName} 
										contactPhone={m.contactPhone} 
										deliveryAddress={m.deliveryAddress}
										payment={m.payment}
										items={m.items}
										paymentFailed={m.paymentFailed}
										paymentPending={m.paymentPending}
										isMultiOrder={m.isMultiOrder}
										linkedOrders={m.linkedOrders}
									/>
									{isLastOrderStatus && (
										<div style={{ ...botBubbleStyle, marginTop: 10, maxWidth: 280 }}>
											<div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Did this resolve your query?</div>
											<div style={{ display: 'flex', gap: 8 }}>
												<button onClick={() => submitResolution(true)} style={templateBtnStyle}>Yes</button>
												<button onClick={() => submitResolution(false)} style={templateBtnStyle}>No</button>
											</div>
										</div>
									)}
								</div>
							);
						}
						const isSupportPending = m.meta?.supportRequestStatus === 'pending';
						return (
							<motion.div key={m.id || uuidv4()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
								<div style={m.role === 'user' ? userBubbleStyle : botBubbleStyle}>
									{isSupportPending ? (
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<LoaderSpinner size={16} />
											<div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{formatText(m.text, false)}</div>
										</div>
									) : (
										<div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{formatText(m.text, m.role === "user")}</div>
									)}
									<div style={timeStyle}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
								</div>
							</motion.div>
						);
					})}
					{pendingAssistant && (
						<div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
							<div style={botBubbleStyle}>
								<div style={{ fontSize: 12, color: 'rgba(45,45,45,0.65)', marginBottom: 10 }}>{loaderPhrase || 'Working on that for you…'}</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
									<LoaderSpinner size={16} />
									<LoaderGlow />
								</div>
							</div>
						</div>
					)}
					{/* Phone capture */}
					{awaitingPhone && (
						<div style={{ display: 'flex', justifyContent: 'flex-start', margin: '8px 0 0' }}>
							<div style={botBubbleStyle}>
								<div style={{ fontWeight: 600, marginBottom: 6 }}>Share your 10-digit mobile</div>
								<div style={{ display: 'flex', gap: 8 }}>
									<input value={pendingPhone} onChange={e => setPendingPhone(e.target.value)} placeholder="e.g., 9876543210" style={{ ...textAreaStyle, padding: '8px 10px', minHeight: 0, height: 36, width: 180 }} />
									<button onClick={() => submitPhone()} style={templateBtnStyle}>Submit</button>
								</div>
							</div>
						</div>
					)}
				</div>
				<div style={inputBar}>
					<div style={{ display: 'flex', gap: 10 }}>
						<textarea
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
							placeholder="Type your message..."
							style={{ ...textAreaStyle, opacity: isResetting ? 0.6 : 1 }}
							rows={1}
						/>
						<motion.button whileTap={{ scale: 0.94 }} disabled={!input.trim() || pendingAssistant || isResetting} onClick={handleSend} style={{ ...sendBtnStyle, opacity: (!input.trim() || pendingAssistant || isResetting) ? 0.6 : 1 }}>{(pendingAssistant || isResetting) ? '...' : 'Send'}</motion.button>
					</div>
					{messages.length > 0 && messages[messages.length - 1].meta?.error && (
						<div style={{ marginTop: 10, textAlign: 'center' }}>
							<button onClick={retryLast} style={retryBtnStyle}>Retry</button>
						</div>
					)}
				</div>
			</motion.div>
			{/* Beautiful skeleton loading overlay while resetting */}
			<ResetOverlay visible={isResetting} phrase={resetPhrase} />
		</AnimatePresence>
	);
}

// Styles reused from earlier implementation (trimmed where possible)
const rootStyle = { position: 'fixed', bottom: 20, right: 24, zIndex: 3000, width: 'min(420px, 92vw)', height: 'min(640px, 86vh)', display: 'flex', flexDirection: 'column', borderRadius: 28, boxShadow: '0 18px 48px -8px rgba(0,0,0,0.25)', background: '#ffffff', border: '1px solid rgba(45,45,45,0.12)', overflow: 'hidden', fontFamily: 'Jost, sans-serif' };
const headerStyle = { padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(45,45,45,0.08)', background: 'linear-gradient(120deg,#ffffff,#f5f5f5)' };
const avatar = { width: 40, height: 40, borderRadius: 16, background: '#2d2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, letterSpacing: 0.5, fontSize: 14 };
const titleStyle = { fontSize: 15, fontWeight: 600, color: '#2d2d2d' };
const subtitleStyle = { fontSize: 11, color: 'rgba(45,45,45,0.55)', fontWeight: 500 };
const messagesContainer = { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '18px 18px 12px', background: 'radial-gradient(circle at 80% 10%, rgba(45,45,45,0.04), transparent 60%)' };
const emptyIntro = { textAlign: 'center', marginTop: 40, color: 'rgba(45,45,45,0.55)', fontSize: 14, lineHeight: 1.5 };
const templatesWrap = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' };
const baseBubble = { padding: '10px 14px 16px', borderRadius: 22, maxWidth: '78%', fontSize: 14, lineHeight: 1.5, letterSpacing: 0.2, position: 'relative', boxShadow: '0 8px 22px -6px rgba(0,0,0,0.08)' };
const userBubbleStyle = { ...baseBubble, background: '#2d2d2d', color: '#ffffff', borderBottomRightRadius: 8, fontWeight: 500 };
const botBubbleStyle = { ...baseBubble, background: '#f5f5f5', color: '#2d2d2d', borderBottomLeftRadius: 8, fontWeight: 500 };
const timeStyle = { fontSize: 10, opacity: 0.55, marginTop: 6, textAlign: 'right', fontWeight: 500 };
const textAreaStyle = { flex: 1, resize: 'none', border: '1px solid rgba(45,45,45,0.18)', borderRadius: 18, padding: '12px 14px', outline: 'none', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.4, background: '#fff', color: '#2d2d2d', fontWeight: 500, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.06)' };
const sendBtnStyle = { background: '#2d2d2d', color: '#fff', border: 'none', borderRadius: 18, padding: '0 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14, letterSpacing: 0.3, boxShadow: '0 6px 20px -6px rgba(0,0,0,0.4)' };
const templateBtnStyle = { background: '#ffffff', border: '1px solid rgba(45,45,45,0.15)', padding: '8px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer', fontWeight: 500, color: '#2d2d2d', boxShadow: '0 4px 10px rgba(0,0,0,0.04)' };
const inputBar = { padding: '14px 16px 16px', borderTop: '1px solid rgba(45,45,45,0.08)', background: '#fff' };
const retryBtnStyle = { background: '#2d2d2d', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 14, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const iconBtnStyle = { background: 'rgba(45,45,45,0.06)', border: '1px solid rgba(45,45,45,0.15)', color: '#2d2d2d', width: 34, height: 34, borderRadius: 12, cursor: 'pointer', fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' };
// Lightweight regex-based formatter for IDs, URLs, and status keywords
function formatText(txt, isUser = false) {
	if (!txt) return '';
	// Create copy buttons for objectIds and phone numbers; build markup manually and attach click handlers
	// Basic list/paragraph formatting: convert lines starting with •/-/* into list items; numbers into ordered items
	// We'll do a lightweight transform while preserving links and tokens handled below
	let html = txt;

	// Helper to safely avoid adding copy buttons inside links
	const wrapCopyable = (match, value) =>
		match.includes("href=")
			? match
			: `<span class="mc-copyable" data-copy="${value}" style="font-family: ui-monospace, monospace; background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 8px;">${value} <button class="mc-copy-btn" data-copy="${value}" style="margin-left:6px; font-size:10px; padding:2px 6px; border:1px solid rgba(45,45,45,0.2); border-radius:6px; background:#fff; cursor:pointer; color:rgba(45,45,45,0.75);">Copy</button></span>`;

	html = html
		.replace(/\b([a-f0-9]{24})\b/gi, (m, v) => wrapCopyable(m, v))
		.replace(
			/(https?:\/\/[^\s<]+)/gi,
			'<a href="$1" target="_blank" rel="noopener" style="color:inherit; text-decoration: underline; word-break: break-all; overflow-wrap: anywhere;">$1</a>'
		)
		// ISO dates YYYY-MM-DD or YYYY/MM/DD
		.replace(
			/\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/g,
			'<span style="background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px;">$1</span>'
		)
		// Common Indian format DD/MM/YYYY or DD-MM-YYYY
		.replace(
			/\b(\d{2}[\/-]\d{2}[\/-]\d{4})\b/g,
			'<span style="background: rgba(45,45,45,0.06); padding: 2px 6px; border-radius: 6px;">$1</span>'
		)
		// Indian phone numbers (10 digits, optionally prefixed by +91 or 0)
		.replace(/\b(?:\+91[-\s]?)?([6-9]\d{9})\b/g, (m, v) => wrapCopyable(m, v));

	// Highlight keywords only if not user
	if (!isUser) {
		html = html.replace(
			/\b(delivered|shipped|in transit|out for delivery|cancelled|returned|rto)\b/gi,
			'<strong style="color:#2d2d2d; padding: 2px 6px; border-radius: 6px; text-transform: capitalize;">$1</strong>'
		);
	}


	// Convert bullet points
	if (/^(?:\s*[•\-*]\s+.+)$/m.test(txt)) {
		html = html.replace(/^(\s*[•\-*]\s+.+)$/gm, '<li>$1<\/li>')
			.replace(/<li>\s*[•\-*]\s+/g, '<li>');
		html = `<ul style="margin:6px 0 6px 16px; padding:0; list-style:disc;">${html}<\/ul>`;
	}
	// Convert ordered lists
	if (/^(\s*\d+\.\s+.+)$/m.test(txt)) {
		html = html.replace(/^(\s*\d+\.\s+.+)$/gm, '<li>$1<\/li>')
			.replace(/<li>\s*\d+\.\s+/g, '<li>');
		html = `<ol style="margin:6px 0 6px 16px; padding:0; list-style:decimal;">${html}<\/ol>`;
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
