'use client';

import { useEffect, useRef } from 'react';

// Global state to track active overlays
const activeOverlays = {
  entries: [],
  // Add an overlay to track
  add(key, priority, handler) {
    this.entries.push({ key, priority, handler });
    // Sort by priority (highest first)
    this.entries.sort((a, b) => b.priority - a.priority);
  },
  // Remove an overlay
  remove(key) {
    this.entries = this.entries.filter(entry => entry.key !== key);
  },
  // Handle the back button - only execute the highest priority handler
  handleBack() {
    if (this.entries.length > 0) {
      // Get highest priority handler (first in the sorted array)
      const topEntry = this.entries[0];
      topEntry.handler();
      return true;
    }
    return false;
  },
  // Check if a key exists in active overlays
  has(key) {
    return this.entries.some(entry => entry.key === key);
  }
};

// Set up a single global popstate listener
if (typeof window !== 'undefined' && !window.__historyStateHandlerAttached) {
  window.addEventListener('popstate', (e) => {
    if (activeOverlays.handleBack()) {
      // If an overlay was handled, prevent default navigation
      e.preventDefault();
    }
  });
  window.__historyStateHandlerAttached = true;
}

/**
 * A hook that handles history state management for overlays like drawers and dialogs
 * 
 * @param {boolean} isOpen - Whether the component is currently open
 * @param {Function} onClose - Function to call when back navigation occurs
 * @param {string} stateKey - Unique identifier for this history entry
 * @param {number} priority - Priority level (higher numbers = higher priority)
 * @return {void}
 */
const useHistoryState = (isOpen, onClose, stateKey, priority = 0) => {
  const hasAddedHistoryRef = useRef(false);
  const stateKeyRef = useRef(stateKey);
  const priorityRef = useRef(priority);
  const onCloseRef = useRef(onClose);

  // Update refs when dependencies change
  useEffect(() => {
    stateKeyRef.current = stateKey;
    priorityRef.current = priority;
    onCloseRef.current = onClose;
  }, [stateKey, priority, onClose]);

  // Handle component open/close
  useEffect(() => {
    // Component opened
    if (isOpen && !hasAddedHistoryRef.current) {
      // Save scroll position
      const scrollY = window.scrollY;
      
      // Add history state and register with global tracker
      const key = `${stateKeyRef.current}_${Date.now()}`;
      
      // Push a custom state to history API
      window.history.pushState(
        { overlay: key, timestamp: Date.now() },
        '',
        window.location.href
      );
      
      // Register this overlay with the global tracker
      activeOverlays.add(key, priorityRef.current, () => {
        // This will be called when the back button is pressed
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      });
      
      // Restore scroll position
      window.scrollTo(0, scrollY);
      
      hasAddedHistoryRef.current = true;
      
      // Cleanup when component unmounts or changes
      return () => {
        if (hasAddedHistoryRef.current) {
          // Remove from global tracker
          activeOverlays.remove(key);
          hasAddedHistoryRef.current = false;
        }
      };
    }
    
    // Component closed
    if (!isOpen && hasAddedHistoryRef.current) {
      // Just reset the flag, actual cleanup happens in the effect cleanup
      hasAddedHistoryRef.current = false;
    }
  }, [isOpen]);

  // Return nothing
  return null;
};

export default useHistoryState;
