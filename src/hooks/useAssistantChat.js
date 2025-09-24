// Re-implemented assistant chat hook (was empty causing TypeError)
// Minimal feature set: fetch history, send messages, reset, pending state, retry last
// Future: extend for function-call structured messages (product_gallery etc.)

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setAssistantCategories } from '@/store/slices/assistantContextSlice';

const API_BASE = '/api/assistant/chat';

function generateTempUserId() {
	return 'anon-' + Math.random().toString(36).slice(2, 10);
}

export default function useAssistantChat({ userId: providedUserId } = {}) {
	const [userId] = useState(providedUserId || generateTempUserId());
	const [messages, setMessages] = useState([]); // {id, role, text, created_at, meta?}
	const [threadId, setThreadId] = useState(null);
	const [loadingHistory, setLoadingHistory] = useState(true);
	const [pendingAssistant, setPendingAssistant] = useState(false);
	const [error, setError] = useState(null);
	const lastUserMessageRef = useRef(null);
	const assistantContext = useSelector(s => s.assistantContext);
	const dispatch = useDispatch();

	// Lazy fetch & cache categories (non-blocking) the first time we detect a product search intent
	const ensureCategoriesCached = useCallback(async () => {
		if (assistantContext?.categories || assistantContext?.categoriesFetchedAt) return; // already fetched
		try {
			const resp = await fetch('/api/assistant/categories');
			if (!resp.ok) return; // silent fail
			const data = await resp.json();
			if (Array.isArray(data.categories)) {
				dispatch(setAssistantCategories(data.categories));
			}
		} catch (_) {
			// swallow errors – chat must remain resilient
		}
	}, [assistantContext?.categories, assistantContext?.categoriesFetchedAt, dispatch]);

	// --- Heuristic Intent Detection for Product Search ---
		const detectProductSearchIntent = useCallback((raw) => {
		if (!raw) return null;
		const text = raw.toLowerCase();
		// Skip if user explicitly wants plain answer
		if (text.startsWith('explain ') || text.startsWith('what is ') || text.includes('policy')) return null;
		// Basic verbs indicating intent
		const actionWords = /(show|suggest|find|recommend|get|need|want|search|see)\b/;
		if (!actionWords.test(text)) return null;
		// Domain product keywords
		const productWords = /(wrap|pillar|tank|fragrance|perfume|scent|keychain|accessor|sticker|decal)/;
		if (!productWords.test(text)) return null;
		// Price extraction
		let maxPrice; let minPrice;
		const underMatch = text.match(/(?:under|below|less than|upto|up to)\s*(\d{2,6})/);
		if (underMatch) maxPrice = Number(underMatch[1]);
		const aboveMatch = text.match(/(?:above|over|more than|greater than)\s*(\d{2,6})/);
		if (aboveMatch) minPrice = Number(aboveMatch[1]);
		if (maxPrice && minPrice && minPrice > maxPrice) { const tmp = minPrice; minPrice = maxPrice; maxPrice = tmp; }
		// Category inference
		let categoryTitle;
		if (/pillar/.test(text)) categoryTitle = 'pillar';
		else if (/tank/.test(text)) categoryTitle = 'tank';
		else if (/fragrance|perfume|scent/.test(text)) categoryTitle = 'car fragrance';
		else if (/keychain/.test(text)) categoryTitle = 'keychain';
		// Fall back to context category if none inferred
		if (!categoryTitle && assistantContext?.categoryTitle) categoryTitle = assistantContext.categoryTitle;
		// Extract explicit numeric only queries like "1000 rs wrap" -> treat as maxPrice
		if (!maxPrice) {
			const loneNumber = text.match(/\b(\d{3,5})\b/);
			if (loneNumber) {
				const num = Number(loneNumber[1]);
				if (num > 50) maxPrice = num; // assume it's a price
			}
		}
			return {
			intent: 'product_search',
			params: { query: raw, maxPrice, minPrice, categoryTitle }
		};
		}, [assistantContext]);

	// Fetch existing thread/history on mount/userId change
	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoadingHistory(true);
			try {
				const resp = await fetch(`${API_BASE}?userId=${encodeURIComponent(userId)}`);
				if (!resp.ok) throw new Error('History fetch failed');
				const data = await resp.json();
				if (cancelled) return;
				setThreadId(data.threadId || null);
				if (Array.isArray(data.messages)) {
					setMessages(data.messages);
				}
			} catch (e) {
				if (!cancelled) setError(e.message);
			} finally {
				if (!cancelled) setLoadingHistory(false);
			}
		})();
		return () => { cancelled = true; };
	}, [userId]);

		// Tool invocation (search products pagination / initial)
		const invokeProductSearch = useCallback(async (params) => {
			// Opportunistically trigger category cache (don't await)
			ensureCategoriesCached();
			setPendingAssistant(true);
			try {
				const resp = await fetch(API_BASE, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, action: 'tool:search_products', toolInvocation: params })
				});
				if (!resp.ok) throw new Error('Tool call failed');
				const data = await resp.json();
				if (data.tool === 'search_products' && data.data) {
					const galleryMsg = {
						id: 'gallery-' + Date.now(),
						role: 'assistant',
						type: 'product_gallery',
						products: data.data.products || [],
						queryEcho: data.data.queryEcho,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, galleryMsg]);
				}
			} catch (e) {
				setError(e.message);
			} finally {
				setPendingAssistant(false);
			}
		}, [userId, ensureCategoriesCached]);

		const sendMessage = useCallback(async (text) => {
			const content = text?.trim();
			if (!content) return;

			// Detect product search intent and short-circuit to tool
			const intent = detectProductSearchIntent(content);
			if (intent?.intent === 'product_search') {
				// Kick off category caching early if needed
				ensureCategoriesCached();
				const userMsg = { id: 'local-' + Date.now(), role: 'user', text: content, created_at: new Date().toISOString(), meta: { autoTool: 'search_products' } };
				setMessages(prev => [...prev, userMsg]);
				lastUserMessageRef.current = content;
				invokeProductSearch({ ...intent.params });
				return;
			}
			// Append user message optimistically
			const userMsg = {
				id: 'local-' + Date.now(),
				role: 'user',
				text: content,
				created_at: new Date().toISOString()
			};
			setMessages(prev => [...prev, userMsg]);
			lastUserMessageRef.current = content;
			setPendingAssistant(true);
			setError(null);
			try {
				const resp = await fetch(API_BASE, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, message: content })
				});
				if (!resp.ok) throw new Error('Send failed');
				const data = await resp.json();
				if (data.reply) {
					const assistantMsg = {
						id: 'assist-' + Date.now(),
						role: 'assistant',
						text: data.reply,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, assistantMsg]);
				}
				if (data.threadId) setThreadId(data.threadId);
			} catch (e) {
				setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, meta: { error: true } } : m));
				setError(e.message);
			} finally {
				setPendingAssistant(false);
			}
		}, [userId, invokeProductSearch, detectProductSearchIntent, ensureCategoriesCached]);

	const retryLast = useCallback(() => {
		if (lastUserMessageRef.current) {
			sendMessage(lastUserMessageRef.current);
		}
	}, [sendMessage]);

	const resetChat = useCallback(async () => {
		try {
			await fetch(API_BASE, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, action: 'reset' })
			});
		} catch (e) {
			// Ignore reset network errors for now
		}
		setMessages([]);
		setThreadId(null);
	}, [userId]);

	return {
		userId,
		threadId,
		messages,
		loadingHistory,
		pendingAssistant,
		error,
		sendMessage,
		retryLast,
			resetChat,
			invokeProductSearch
	};
}
