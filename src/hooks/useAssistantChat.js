// Re-implemented assistant chat hook (was empty causing TypeError)
// Minimal feature set: fetch history, send messages, reset, pending state, retry last
// Future: extend for function-call structured messages (product_gallery etc.)

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchDisplayAssets } from '@/lib/utils/fetchutils';
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
    const [isResetting, setIsResetting] = useState(false);
	const [error, setError] = useState(null);
	const [classification, setClassification] = useState(null);
	const [needsResolutionCheck, setNeedsResolutionCheck] = useState(false);
	const [awaitingPhone, setAwaitingPhone] = useState(false);
	const [pendingPhone, setPendingPhone] = useState('');
	const [userChats, setUserChats] = useState([]);
	const lastUserMessageRef = useRef(null);
	const lastSearchContinuationRef = useRef(null); // { page, limit, filters, hint }
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

	// --- Heuristic Intent Detection for Product Search & Pagination ---
		const detectProductSearchIntent = useCallback((raw) => {
		if (!raw) return null;
		const text = raw.toLowerCase();
		// Skip if user explicitly wants plain answer
		if (text.startsWith('explain ') || text.startsWith('what is ') || text.includes('policy')) return null;
		// Basic verbs indicating intent
		const actionWords = /(show|suggest|find|recommend|get|need|want|search|see)\b/;
		// Pagination quick commands: "show more", "more", "next"
		if (/^(show\s+more|more|next|next\s+page)$/i.test(text.trim())) {
			if (lastSearchContinuationRef.current) {
				const { page, limit, filters } = lastSearchContinuationRef.current;
				return { intent: 'product_pagination', params: { page: (page || 1) + 1, limit: limit || 6, ...filters } };
			}
			// No previous search – fall through to generic intent detection
		}
		// "show N" or "show N more" where N<=10
		const showN = text.match(/\bshow\s+(\d{1,2})\b/);
		if (showN && Number(showN[1]) > 0) {
			const n = Math.min(10, Math.max(1, Number(showN[1])));
			if (lastSearchContinuationRef.current) {
				const { page, filters } = lastSearchContinuationRef.current;
				return { intent: 'product_pagination', params: { page: (page || 1), limit: n, ...filters } };
			}
			// If no previous search, treat as new search with limit only
		}
		const hasAction = actionWords.test(text);
		// Domain product keywords
		const productWords = /(wrap|pillar|tank|fragrance|perfume|scent|keychain|accessor|sticker|decal|product|products|item|items)/;
		// Price extraction
		let maxPrice; let minPrice;
		const underMatch = text.match(/(?:under|below|less than|upto|up to)\s*(\d{2,6})/);
		if (underMatch) maxPrice = Number(underMatch[1]);
		const aboveMatch = text.match(/(?:above|over|more than|greater than)\s*(\d{2,6})/);
		if (aboveMatch) minPrice = Number(aboveMatch[1]);
		if (maxPrice && minPrice && minPrice > maxPrice) { const tmp = minPrice; minPrice = maxPrice; maxPrice = tmp; }
		// Category inference (avoid over-constraining when user says "any wrap" or negates pillar)
		let categoryTitle;
		const anyWrap = /\bany\s+wrap\b/.test(text);
		const negatePillar = /not\s+just\s+pillar/.test(text) || /not\s+only\s+pillar/.test(text);
		if (!anyWrap && !negatePillar) {
			if (/pillar/.test(text)) categoryTitle = 'pillar';
			else if (/tank/.test(text)) categoryTitle = 'tank';
			else if (/fragrance|perfume|scent/.test(text)) categoryTitle = 'car fragrance';
			else if (/keychain/.test(text)) categoryTitle = 'keychain';
		}
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
		// Sort intent
		let sortBy;
		if (/most ordered|best\s*-?selling|popular|top (?:sellers|selling)/.test(text)) sortBy = 'orders';
		if (/low(?:est)? to high|cheapest|price asc/.test(text)) sortBy = 'price_asc';
		if (/high(?:est)? to low|expensive|price desc/.test(text)) sortBy = 'price_desc';

		const hasSortIntent = Boolean(sortBy);
		// If no explicit action verb, allow sort-intent + product words to trigger a gallery (e.g., "popular products")
		if (!hasAction) {
			if (!(hasSortIntent && productWords.test(text))) return null;
		}
		// If we had action or sort intent, ensure there is at least some domain product term to avoid false positives
		if (!productWords.test(text)) return null;

		// Respect explicit show N on the first query if present
		let limit;
		const showNFirst = text.match(/\bshow\s+(\d{1,2})\b/);
		if (showNFirst) {
			const n = Math.min(10, Math.max(1, Number(showNFirst[1])));
			if (!isNaN(n)) limit = n;
		}
			return {
			intent: 'product_search',
			params: { query: raw, maxPrice, minPrice, categoryTitle, sortBy, ...(limit ? { limit } : {}) }
		};
		}, [assistantContext]);

	// --- Heuristic detection for Order Status ---
	const detectOrderStatusIntent = useCallback((raw) => {
		if (!raw) return null;
		const text = raw.trim();
		// Basic ObjectId pattern
		const idMatch = text.match(/\b[a-f0-9]{24}\b/i);
		if (idMatch) {
			return { intent: 'order_status', params: { orderId: idMatch[0] } };
		}
		return null;
	}, []);

	// --- Detect very broad "show products" intent to present a category grid ---
	const detectGenericBrowseIntent = useCallback((raw) => {
		if (!raw) return null;
		const text = raw.toLowerCase().trim();
		// Examples: "show me products", "show products", "show me all products", "all products", "browse products", "view products"
		if (/^(show\s+me\s+)?(all\s+)?products$/.test(text) || /\b(browse|view)\s+products\b/.test(text) || /^all\s+products$/.test(text)) {
			return { intent: 'browse_categories' };
		}
		return null;
	}, []);

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
						hasMore: !!data.data.hasMore,
						continuation: data.data.continuation || null,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, galleryMsg]);
					// Remember continuation for "show more"
					if (data.data.continuation) {
						lastSearchContinuationRef.current = data.data.continuation;
					}
					// Friendly follow-up to prompt more
					if (data.data.hasMore) {
						const followupMsg = {
							id: 'assist-follow-' + Date.now(),
							role: 'assistant',
							text: 'Want me to show more? You can say "show more" or "show 5" (max 10).',
							created_at: new Date().toISOString()
						};
						setMessages(prev => [...prev, followupMsg]);
					}
				} else if (data.tool === 'browse_categories' && data.data) {
					const gridMsg = {
						id: 'cats-' + Date.now(),
						role: 'assistant',
						type: 'category_grid',
						title: data.data.title,
						items: data.data.items || [],
						hint: data.data.hint,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, gridMsg]);
				}
				// Add optional textual reply from server, if present
				if (data.reply) {
					const assistantMsg = { id: 'assist-' + Date.now(), role: 'assistant', text: data.reply, created_at: new Date().toISOString() };
					setMessages(prev => [...prev, assistantMsg]);
				}
				// Update classification flags
				if (data.classification) {
					setClassification(data.classification);
					const shouldAsk = !!(data.classification.needsResolutionCheck || data.classification.type === 'query');
					setNeedsResolutionCheck(shouldAsk);
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

			// Intents: order -> generic browse -> product search/pagination
			const orderIntent = detectOrderStatusIntent(content);
			if (orderIntent?.intent === 'order_status') {
				const userMsg = { id: 'local-' + Date.now(), role: 'user', text: content, created_at: new Date().toISOString(), meta: { autoTool: 'get_order_status' } };
				setMessages(prev => [...prev, userMsg]);
				setUserChats(prev => [...prev, content]);
				lastUserMessageRef.current = content;
				setPendingAssistant(true);
				try {
					const resp = await fetch(API_BASE, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userId, action: 'tool:get_order_status', toolInvocation: orderIntent.params })
					});
					if (!resp.ok) throw new Error('Tool call failed');
					const data = await resp.json();
					const payload = data?.data;
					const statusMsg = {
						id: 'order-' + Date.now(),
						role: 'assistant',
						type: 'order_status',
						orderId: payload?.orderId,
						status: payload?.status,
						eta: payload?.expectedDelivery || null,
						trackUrl: payload?.trackUrl || null,
						steps: Array.isArray(payload?.steps) ? payload.steps : [],
						orderedAt: payload?.orderedAt || payload?.order?.orderedAt || null,
						deliveryAddress: payload?.deliveryAddress || payload?.customer?.address || null,
						contactName: payload?.contactName || payload?.customer?.name || null,
						contactPhone: payload?.contactPhone || payload?.customer?.phone || null,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, statusMsg]);
					if (data.classification) {
						setClassification(data.classification);
						const shouldAsk = !!(data.classification.needsResolutionCheck || data.classification.type === 'query');
						setNeedsResolutionCheck(shouldAsk);
					}
				} catch (e) {
					setError(e.message);
				} finally {
					setPendingAssistant(false);
				}
				return;
			}

			const genericIntent = detectGenericBrowseIntent(content);
			if (genericIntent?.intent === 'browse_categories') {
				const userMsg = { id: 'local-' + Date.now(), role: 'user', text: content, created_at: new Date().toISOString(), meta: { autoTool: 'browse_categories' } };
				setMessages(prev => [...prev, userMsg]);
				setUserChats(prev => [...prev, content]);
				lastUserMessageRef.current = content;
				setPendingAssistant(true);
				try {
					const toRelativeLink = (link) => {
						if (!link) return link;
						try {
							if (/^https?:\/\//i.test(link)) {
								const u = new URL(link);
								return (u.pathname || '/') + (u.search || '') + (u.hash || '');
							}
							if (/^\/\//.test(link)) {
								const u = new URL('https:' + link);
								return (u.pathname || '/') + (u.search || '') + (u.hash || '');
							}
							return link.startsWith('/') ? link : '/' + link;
						} catch (_) {
							return link.startsWith('/') ? link : '/' + link;
						}
					};
					const { assets = [] } = await fetchDisplayAssets('homepage');
					const cats = (assets || []).filter(a => a?.isActive && (a?.componentName === 'category-grid' || a?.componentName === 'category-slider'));
					const items = cats.map(a => ({ title: a?.content || a?.title || 'Category', image: a?.media?.desktop || a?.media?.mobile || null, link: toRelativeLink(a?.link || '#') }));
					const hint = 'If you’d like, tell me a specific category like “Window Pillar Wrap” and I’ll open products from there.';
					const gridMsg = { id: 'cats-' + Date.now(), role: 'assistant', type: 'category_grid', title: 'Shop by Category', items, hint, created_at: new Date().toISOString() };
					setMessages(prev => [...prev, gridMsg]);
				} catch (e) {
					setError(e.message);
				} finally {
					setPendingAssistant(false);
				}
				return;
			}

			const intent = detectProductSearchIntent(content);
			if (intent?.intent === 'product_search') {
				// Kick off category caching early if needed
				ensureCategoriesCached();
				const userMsg = { id: 'local-' + Date.now(), role: 'user', text: content, created_at: new Date().toISOString(), meta: { autoTool: 'search_products' } };
				setMessages(prev => [...prev, userMsg]);
				setUserChats(prev => [...prev, content]);
				lastUserMessageRef.current = content;
				invokeProductSearch({ ...intent.params });
				return;
			}
			if (intent?.intent === 'product_pagination') {
				const userMsg = { id: 'local-' + Date.now(), role: 'user', text: content, created_at: new Date().toISOString(), meta: { autoTool: 'search_products_pagination' } };
				setMessages(prev => [...prev, userMsg]);
				setUserChats(prev => [...prev, content]);
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
			setUserChats(prev => [...prev, content]);
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
				// Planner may return a tool result directly
				if (data.tool === 'browse_categories' && data.data) {
					const gridMsg = { id: 'cats-' + Date.now(), role: 'assistant', type: 'category_grid', title: data.data.title, items: data.data.items, hint: data.data.hint, created_at: new Date().toISOString() };
					setMessages(prev => [...prev, gridMsg]);
				} else if (data.tool === 'search_products' && data.data) {
					const galleryMsg = { id: 'gallery-' + Date.now(), role: 'assistant', type: 'product_gallery', products: data.data.products || [], queryEcho: data.data.queryEcho, hasMore: !!data.data.hasMore, continuation: data.data.continuation || null, created_at: new Date().toISOString() };
					setMessages(prev => [...prev, galleryMsg]);
					if (data.data.continuation) { lastSearchContinuationRef.current = data.data.continuation; }
					if (data.data.hasMore) {
						const followupMsg = { id: 'assist-follow-' + Date.now(), role: 'assistant', text: 'Want me to show more? You can say "show more" or "show 5" (max 10).', created_at: new Date().toISOString() };
						setMessages(prev => [...prev, followupMsg]);
					}
				} else if (data.tool === 'get_order_status' && data.data) {
					const payload = data.data;
					const statusMsg = { id: 'order-' + Date.now(), role: 'assistant', type: 'order_status', orderId: payload?.orderId, status: payload?.status, eta: payload?.expectedDelivery || null, trackUrl: payload?.trackUrl || null, steps: Array.isArray(payload?.steps) ? payload.steps : [], orderedAt: payload?.orderedAt || payload?.order?.orderedAt || null, deliveryAddress: payload?.deliveryAddress || payload?.customer?.address || null, contactName: payload?.contactName || payload?.customer?.name || null, contactPhone: payload?.contactPhone || payload?.customer?.phone || null, created_at: new Date().toISOString() };
					setMessages(prev => [...prev, statusMsg]);
				} else if (data.reply) {
					const assistantMsg = {
						id: 'assist-' + Date.now(),
						role: 'assistant',
						text: data.reply,
						created_at: new Date().toISOString()
					};
					setMessages(prev => [...prev, assistantMsg]);
				}
				// Update classification flags on any path
				if (data.classification) {
					setClassification(data.classification);
					const shouldAsk = !!(data.classification.needsResolutionCheck || data.classification.type === 'query');
					setNeedsResolutionCheck(shouldAsk);
				}
				if (data.threadId) setThreadId(data.threadId);
			} catch (e) {
				setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, meta: { error: true } } : m));
				setError(e.message);
			} finally {
				setPendingAssistant(false);
			}
		}, [userId, invokeProductSearch, detectProductSearchIntent, detectOrderStatusIntent, detectGenericBrowseIntent, ensureCategoriesCached]);

	const retryLast = useCallback(() => {
		if (lastUserMessageRef.current) {
			sendMessage(lastUserMessageRef.current);
		}
	}, [sendMessage]);

	const resetChat = useCallback(() => {
		// Optimistic, instant UI clear
		setIsResetting(true);
		setMessages([]);
		setThreadId(null);
		setError(null);
		setClassification(null);
		setNeedsResolutionCheck(false);
		setAwaitingPhone(false);
		setPendingPhone('');
		setUserChats([]);
		// Fire-and-forget network call with timeout so we always end resetting
		(async () => {
			const controller = new AbortController();
			const t = setTimeout(() => controller.abort(), 5000);
			try {
				await fetch(API_BASE, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId, action: 'reset' }),
					signal: controller.signal
				});
			} catch (_) {
				// swallow errors; UI already reset locally
			} finally {
				clearTimeout(t);
				setIsResetting(false);
			}
		})();
		// Resolve immediately so callers don't block
		return Promise.resolve();
	}, [userId]);

	// Resolution check & phone capture
	const submitResolution = useCallback((resolved) => {
		if (resolved) {
			setNeedsResolutionCheck(false);
			setAwaitingPhone(false);
			setPendingPhone('');
			setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: 'Glad it helped! If you need anything else, just ask.', created_at: new Date().toISOString() }]);
		} else {
			setNeedsResolutionCheck(false);
			setAwaitingPhone(true);
			setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: 'No worries—I’ll share your query to the support team. Please share your 10-digit mobile number so our team can call you.', created_at: new Date().toISOString() }]);
		}
	}, []);

	const validatePhone = (p) => {
		if (!p) return false;
		const digits = String(p).replace(/\D/g, '');
		return digits.length === 10;
	};

	const submitPhone = useCallback(async (phone) => {
		const digits = String(phone || pendingPhone).replace(/\D/g, '');
		if (!validatePhone(digits)) {
			setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: 'That doesn’t look like a 10-digit mobile number. Please re-enter.', created_at: new Date().toISOString() }]);
			return false;
		}
		setAwaitingPhone(false);
		setPendingPhone('');
		const lastUser = [...userChats].slice(-3).join('\n');
		const lastAssistant = [...messages].filter(m => m.role === 'assistant' && m.text).slice(-2).map(m => m.text).join('\n');
		const category = classification?.category || 'general';
		const subcategory = classification?.subcategory || '';
		const issue = `${category}${subcategory ? ' / ' + subcategory : ''} — ${lastUser?.slice(0, 300)}`;
		const aiResponse = (lastAssistant || '').slice(0, 1000);
		try {
			const res = await fetch('/api/support/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, threadId, mobile: digits, email: null, category, subcategory, issue, aiResponse, userChats }) });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Support request failed');
			setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: 'Thanks! We’ve created a support request. Our team will reach out to you shortly.', created_at: new Date().toISOString() }]);
			return true;
		} catch (e) {
			setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: 'Sorry, we couldn’t create a support request right now. Please try again in a moment.', created_at: new Date().toISOString() }]);
			return false;
		}
	}, [userId, threadId, classification, messages, userChats, pendingPhone]);

	return {
		userId,
		threadId,
		messages,
		loadingHistory,
		pendingAssistant,
            isResetting,
		error,
		sendMessage,
		retryLast,
			resetChat,
			invokeProductSearch,
		// classification & handoff
		classification,
		needsResolutionCheck,
		submitResolution,
		awaitingPhone,
		pendingPhone,
		setPendingPhone,
		submitPhone
	};
}
