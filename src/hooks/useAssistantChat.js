'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const THREAD_KEY = 'chat_thread_id';
const TEMP_USER_KEY = 'tempUserId';

export default function useAssistantChat({ userId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false); // sending user message / awaiting assistant
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [error, setError] = useState(null);
  const [pendingAssistant, setPendingAssistant] = useState(false); // true between user send & assistant reply
  const pendingMetaRef = useRef({ retryPayload: null });
  const tempUserIdRef = useRef(null);

  // ensure temp user id exists
  useEffect(() => {
    let temp = typeof window !== 'undefined' ? localStorage.getItem(TEMP_USER_KEY) : null;
    if (!temp) {
      temp = uuidv4();
      if (typeof window !== 'undefined') localStorage.setItem(TEMP_USER_KEY, temp);
    }
    tempUserIdRef.current = temp;
  }, []);

  const effectiveUserId = userId || tempUserIdRef.current;

  // load history
  useEffect(() => {
    if (!effectiveUserId) return;
    let mounted = true;
    async function load() {
      setLoadingHistory(true);
      setError(null);
      try {
        const res = await fetch(`/api/assistant/chat?userId=${encodeURIComponent(effectiveUserId)}`);
        if (!mounted) return;
        if (!res.ok) throw new Error('Failed to load history');
        const data = await res.json();
        setMessages(data.messages || []);
        if (data.threadId) {
          setThreadId(data.threadId);
          localStorage.setItem(THREAD_KEY, data.threadId);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [effectiveUserId]);

  const sendMessage = useCallback(async (text, opts = {}) => {
    if (!text?.trim()) return;
    const trimmed = text.trim();
    setError(null);
    const userMsg = { id: `u-${uuidv4()}`, role: 'user', text: trimmed, created_at: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    setPendingAssistant(true);
    pendingMetaRef.current.retryPayload = { message: trimmed };
    try {
      const body = { message: trimmed, userId: effectiveUserId };
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.threadId) {
        setThreadId(data.threadId);
        localStorage.setItem(THREAD_KEY, data.threadId);
      }
      if (!res.ok) throw new Error(data.error || 'Assistant error');
      const reply = data?.reply || '';
      if (reply) {
        setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply, created_at: new Date().toISOString() }]);
      } else {
        // show graceful empty fallback
        setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: 'Hmm, I did not get a response. Try rephrasing?', created_at: new Date().toISOString(), meta: { empty: true } }]);
      }
    } catch (e) {
      console.error(e);
      setMessages(m => [...m, { id: `ae-${Date.now()}`, role: 'assistant', text: 'Failed to fetch response. Retry?', created_at: new Date().toISOString(), meta: { error: true } }]);
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingAssistant(false);
    }
  }, [effectiveUserId]);

  const resetChat = useCallback(async () => {
    try {
      if (!effectiveUserId) return;
      await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', userId: effectiveUserId }),
      });
    } catch (e) {
      console.error('Failed to reset chat', e);
    }
    setMessages([]);
    setThreadId(null);
    if (typeof window !== 'undefined') localStorage.removeItem(THREAD_KEY);
    pendingMetaRef.current.retryPayload = null;
  }, [effectiveUserId]);

  const retryLast = useCallback(() => {
    if (pendingMetaRef.current.retryPayload) {
      sendMessage(pendingMetaRef.current.retryPayload.message);
    }
  }, [sendMessage]);

  return {
    messages,
    loading,
    loadingHistory,
    threadId,
    error,
    pendingAssistant,
    retryLast,
    sendMessage,
    resetChat,
  };
}
