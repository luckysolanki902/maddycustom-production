'use client';
import React, { createContext, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import useAssistantChat from '@/hooks/useAssistantChat';

const ChatSessionContext = createContext(null);

export function ChatSessionProvider({ children }) {
  // Pull userId from redux (order form user) else hook will allocate temp id
  const userId = useSelector(s => s.orderForm.userDetails?.userId);
  const chat = useAssistantChat({ userId });
  const value = useMemo(() => chat, [chat]);
  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  return useContext(ChatSessionContext);
}

// Helper component for root layout usage
export default ChatSessionContext;