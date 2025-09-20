'use client';
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  TextField,
  Paper,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ReactReduxContext } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { v4 as uuidv4 } from "uuid";

function MessageRenderer({ text }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter style={duotoneLight} language={match[1]} PreTag="div" {...props}>
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

const THREAD_KEY = 'chat_thread_id';

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
};

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const containerRef = useRef(null);

  // Optional redux userId
  const reduxContext = useContext(ReactReduxContext);
  const store = reduxContext?.store;
  const [userId, setUserId] = useState(store ? store.getState()?.orderForm?.userDetails?.userId : null);

  useEffect(() => {
    if (store) {
      const unsub = store.subscribe(() => {
        const id = store.getState()?.orderForm?.userDetails?.userId;
        setUserId(id);
      });
      return unsub;
    }
    return undefined;
  }, [store]);

  // menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  useEffect(() => {
    // scroll to bottom when messages update
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, loading]);

  // Load conversation history (prefer server mapping via userId)
  useEffect(() => {
    let tempUserId = localStorage.getItem("tempUserId");
    if (!tempUserId) {
      tempUserId = uuidv4();
      localStorage.setItem("tempUserId", tempUserId);
    }

    let mounted = true;
    async function load() {
      const threadId = typeof window !== 'undefined' ? localStorage.getItem(THREAD_KEY) : null;

      const query =
        (userId || tempUserId)
          ? `?userId=${encodeURIComponent(userId || tempUserId)}`
          : threadId
          ? `?threadId=${encodeURIComponent(threadId)}`
          : "";
      if (!query) return;
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/assistant/chat${query}`, { method: 'GET' });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          if (data.threadId) localStorage.setItem(THREAD_KEY, data.threadId);
        }
      } catch (err) {
        console.error('Error loading messages', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [userId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();

    // optimistic update
    setMessages((m) => [...m, { id: `u-${uuidv4()}`, role: 'user', text, created_at: new Date().toISOString() }]);
    setInput('');
    setLoading(true);

    try {
      const body = { message: text };

      body.userId = userId || localStorage.getItem("tempUserId");

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.threadId) localStorage.setItem(THREAD_KEY, data.threadId);
      const reply = data?.reply || 'No response from assistant.';
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { id: `ae-${Date.now()}`, role: 'assistant', text: 'Error contacting assistant.', created_at: new Date().toISOString() }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  };

  const clearConversation = async () => {
    handleMenuClose();
    if (!confirm('Delete all messages and start a new conversation?')) return;
    setLoading(true);
    try {
      const threadId = typeof window !== 'undefined' ? localStorage.getItem(THREAD_KEY) : null;
      const body = { action: 'reset' };
      if (userId) body.userId = userId;
      if (threadId) body.threadId = threadId;
      await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      localStorage.removeItem(THREAD_KEY);
      setMessages([]);
    } catch (err) {
      console.error(err);
      alert('Failed to reset conversation');
    }
    setLoading(false);
  };

  // typing indicator bubble while assistant is processing
  const TypingIndicator = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Paper sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 0.6 }}>
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 6, height: 6, borderRadius: 6, background: '#6b7280', display: 'inline-block' }} />
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.15 }} style={{ width: 6, height: 6, borderRadius: 6, background: '#6b7280', display: 'inline-block' }} />
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.3 }} style={{ width: 6, height: 6, borderRadius: 6, background: '#6b7280', display: 'inline-block' }} />
        </Box>
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 980, mx: "auto", my: 4, fontFamily: "Inter, Roboto, sans-serif" }}>
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: "hidden", boxShadow: "0 10px 30px rgba(8,12,20,0.06)" }}>
        <Box sx={{ bgcolor: "#fbfdff", px: 3, py: 1, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#000" }}>
                Chatbot
              </Typography>
              {/* <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {userId ? "Logged in" : "Login to save conversation"}
              </Typography> */}
            </Box>
            <Box>
              <IconButton onClick={handleMenuOpen} aria-label="more">
                <MoreVertIcon sx={{ color: "#000" }} />
              </IconButton>
              <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
                <MenuItem onClick={clearConversation} sx={{ color: "#000" }}>
                  <DeleteOutlineIcon sx={{ mr: 1 }} /> Delete All
                </MenuItem>
              </Menu>
            </Box>
          </Box>
        </Box>

        <Box sx={{ height: "68vh", display: "flex", flexDirection: "column" }}>
          <Box ref={containerRef} sx={{ overflowY: "auto", p: 3, flex: 1, bgcolor: "#fff" }}>
            {loadingHistory ? (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <CircularProgress />
                <Typography color="text.secondary">Loading conversation...</Typography>
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography color="text.secondary">Start the conversation — ask your question below.</Typography>
              </Box>
            ) : (
              <motion.div initial="hidden" animate="visible" variants={listVariants}>
                <AnimatePresence initial={false}>
                  {messages.map(m => (
                    <motion.div key={m.id || m.created_at} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                      <Box sx={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", my: 2 }}>
                        <Paper
                          sx={{
                            px: 1.25,
                            pb: 1.25,
                            bgcolor: m.role === "user" ? "#f5f5f5" : "#f6f9ff",
                            color: m.role === "#021124",
                            borderRadius: 2,
                            maxWidth: "78%",
                            minWidth: "6rem",
                          }}
                        >
                          <MessageRenderer text={m.text} />
                          <Typography
                            variant="caption"
                            sx={{ display: "block", textAlign: "right", color: "text.disabled", mb: -1, mt: -2, fontSize: 11 }}
                          >
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </Typography>
                        </Paper>
                      </Box>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <motion.div variants={itemVariants} initial="hidden" animate="visible">
                    <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1 }}>
                      <TypingIndicator />
                    </Box>
                  </motion.div>
                )}
              </motion.div>
            )}
          </Box>

          <Divider />

          <Box
            component="form"
            onSubmit={e => {
              e.preventDefault();
              sendMessage();
            }}
            sx={{ display: "flex", gap: 1, p: 2, alignItems: "center", bgcolor: "#fbfdff" }}
          >
            <Paper
              sx={{
                flex: 1,
                p: "6px 10px",
                borderRadius: 3,
                boxShadow: "0 6px 18px rgba(9,10,13,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: "1px solid #e6e6e6",
                transition: "box-shadow 200ms ease, border-color 200ms ease",
                "&:focus-within": {
                  borderColor: "#cfcfcf",
                  boxShadow: "0 8px 24px rgba(12,20,40,0.06)",
                },
              }}
            >
              <TextField
                multiline
                minRows={1}
                maxRows={6}
                placeholder="Ask me anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                variant="standard"
                InputProps={{ disableUnderline: true }}
              />
              <IconButton
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#111" }, width: 44, height: 44, ml: 1 }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : <SendIcon />}
              </IconButton>
            </Paper>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
