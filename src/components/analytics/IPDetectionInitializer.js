'use client';

import { useEffect } from 'react';
import { preDetectIP } from '@/lib/utils/ipDetection';

/**
 * IPDetectionInitializer
 * 
 * Pre-detects and caches the client's IP address on page load
 * This ensures IP is available when Meta Pixel events are fired
 * Runs in background without blocking UI
 */
export default function IPDetectionInitializer() {
  useEffect(() => {
    // Pre-detect IP on mount - runs in background
    preDetectIP();
  }, []);

  // No UI rendering
  return null;
}
