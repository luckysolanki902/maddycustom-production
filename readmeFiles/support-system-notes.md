# Customer Support & Chat System

This document describes the new unified customer support experience that replaces the legacy FAQ + `/api/openai/chat` flow.

## Key Components

- `useAssistantChat` (hook): Encapsulates loading history, sending messages, resetting a conversation using `/api/assistant/chat`.
- `SupportChatDialog`: Floating animated chat dialog (Framer Motion) with speed-themed UI.
- `SupportChatLauncher`: Floating bubble launcher injected in `layout.js` (dynamically loaded) and hidden automatically when cart drawer, sidebar, or search dialog are open.
- `/faqs` page: Replaced with a new Customer Support page showing quick FAQs + knowledge snapshot + launcher.

## Deprecations
- Old endpoint: `/api/openai/chat` (kept for now but not referenced in UI). New logic uses `/api/assistant/chat` exclusively.
- Legacy `FaqPage` layout replaced by inline quick FAQ cards + chat.

## Persistent Thread Mapping
- The assistant route maps a `userId` to an OpenAI Thread via `AssistantThread` collection.
- Anonymous visitors get a `tempUserId` stored in `localStorage`.

## Starting a New Chat
- User clicks ↺ (reset) inside dialog; we:  
  1. Call POST `/api/assistant/chat` with `{ action: 'reset', userId }`  
  2. Clear local thread + messages  
  3. Preserve historic server-side messages for future training (DB not purged except mapping removed)

## UI Hide Conditions
The chat (launcher + dialog) is hidden whenever:  
- `isCartDrawerOpen`  
- `isSidebarOpen`  
- `isSearchDialogOpen`

## Theming
- Base color: `#2d2d2d` and grayscale neutrals only.
- Minimal shadows + rounded geometry for speed / performance aesthetic.

## Quick Templates
Configured in `SupportChatDialog` via `initialTemplates` array. Extend as needed.

## Future Enhancements (Ideas)
- Streaming responses instead of polling.
- Multi-conversation history UI once required.
- Analytics events (open, send, reset) for funnel tracking.
- Attach product context (cart contents, last viewed) to first message.

---
Last updated: Automated note.
