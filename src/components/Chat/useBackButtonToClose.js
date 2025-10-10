"use client";
import { useEffect, useRef } from 'react';

// When `open` becomes true, push a history state so that pressing back closes the chat instead of navigating away.
export default function useBackButtonToClose(open, onClose) {
  const didPushRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    // Push a dummy state so that a back action will pop it and we can intercept.
    try {
      window.history.pushState({ mcChat: true }, '', window.location.href);
      didPushRef.current = true;
    } catch {}

    const onPopState = (ev) => {
      if (didPushRef.current) {
        // Prevent navigating away by immediately closing chat.
        ev?.preventDefault?.();
        didPushRef.current = false;
        onClose?.();
        // After closing, do not push a new state; user remains on current page.
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      didPushRef.current = false;
    };
  }, [open, onClose]);
}
