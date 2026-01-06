/**
 * React hook for Shiprocket Magic Checkout integration
 * Handles script loading, token fetching, and checkout UI launching
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { loadMagicCheckout, getMagicCheckout } from '@/lib/checkout/loadMagicCheckout';

/**
 * @typedef {Object} MagicCheckoutConfig
 * @property {string} [redirectUrl] - URL to redirect after checkout completion
 * @property {string} [fallbackUrl] - URL to redirect on error/cancel
 * @property {Function} [onTokenCreated] - Callback when access token is created
 * @property {Function} [onLaunch] - Callback when checkout UI is launched
 * @property {Function} [onError] - Callback on error
 * @property {Function} [onClose] - Callback when checkout is closed/cancelled
 */

/**
 * @typedef {Object} LaunchParams
 * @property {Object} payload - Checkout payload (items, totals, user, etc.)
 * @property {Event} [event] - DOM event that triggered the launch (for UI feedback)
 */

/**
 * Hook for managing Shiprocket Magic Checkout
 * @param {MagicCheckoutConfig} config
 * @returns {Object} Hook interface
 */
export default function useMagicCheckout({
  redirectUrl,
  fallbackUrl,
  onTokenCreated,
  onLaunch,
  onError,
  onClose,
} = {}) {
  const [status, setStatus] = useState('idle'); // idle | preparing | launching | active | completed | failed
  const [error, setError] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * Fetch access token from backend
   */
  const fetchAccessToken = useCallback(async (payload) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/checkout/magic/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[useMagicCheckout] Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned non-JSON response (status ${response.status})`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Token fetch failed with status ${response.status}`);
      }

      if (!data.token) {
        throw new Error('Access token missing in response');
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Token fetch cancelled');
      }
      throw err;
    }
  }, []);

  /**
   * Launch Magic Checkout UI
   */
  const launchCheckout = useCallback(async ({ payload, event = null }) => {
    try {
      setStatus('preparing');
      setError(null);

      // Step 1: Fetch access token
      const tokenResponse = await fetchAccessToken(payload);
      setTokenData(tokenResponse);

      // Notify token created
      if (onTokenCreated) {
        try {
          onTokenCreated(tokenResponse);
        } catch (err) {
          console.error('[useMagicCheckout] onTokenCreated callback error:', err);
        }
      }

      // Step 2: Load Shiprocket script
      await loadMagicCheckout();

      // Step 3: Initialize and launch checkout
      const HeadlessCheckout = getMagicCheckout();
      if (!HeadlessCheckout || typeof HeadlessCheckout.addToCart !== 'function') {
        throw new Error('HeadlessCheckout SDK not available');
      }

      setStatus('launching');

      // Launch the checkout UI using HeadlessCheckout.addToCart
      // Signature: HeadlessCheckout.addToCart(event, token, options)
      const checkoutFallbackUrl = fallbackUrl || tokenResponse.fallbackUrl || payload.fallbackUrl;
      
      HeadlessCheckout.addToCart(
        event, // DOM event from button click
        tokenResponse.token, // Access token
        { fallbackUrl: checkoutFallbackUrl } // Options with fallback URL
      );

      // Handle onClose if provided (listen to window messages from Shiprocket)
      if (onClose) {
        const handleCheckoutClose = (e) => {
          if (e.data && e.data.type === 'shiprocket-checkout-close') {
            setStatus('idle');
            try {
              onClose();
            } catch (err) {
              console.error('[useMagicCheckout] onClose callback error:', err);
            }
            window.removeEventListener('message', handleCheckoutClose);
          }
        };
        window.addEventListener('message', handleCheckoutClose);
      }

      setStatus('active');

      // Notify launch success
      if (onLaunch) {
        try {
          onLaunch({
            sessionId: tokenResponse.sessionId,
            shiprocketOrderId: tokenResponse.shiprocketOrderId,
            token: tokenResponse.token,
          });
        } catch (err) {
          console.error('[useMagicCheckout] onLaunch callback error:', err);
        }
      }

      return tokenResponse;
    } catch (err) {
      console.error('[useMagicCheckout] Launch error:', err);
      setStatus('failed');
      setError(err);

      // Notify error
      if (onError) {
        try {
          onError(err);
        } catch (callbackErr) {
          console.error('[useMagicCheckout] onError callback error:', callbackErr);
        }
      }

      throw err;
    }
  }, [fetchAccessToken, fallbackUrl, onTokenCreated, onLaunch, onError, onClose]);

  /**
   * Cancel ongoing token fetch
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setError(null);
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    cancel();
    setTokenData(null);
    setError(null);
    setStatus('idle');
  }, [cancel]);

  return {
    // State
    status,
    error,
    tokenData,
    isReady: status === 'idle',
    isPreparing: status === 'preparing',
    isLaunching: status === 'launching',
    isActive: status === 'active',
    isFailed: status === 'failed',

    // Actions
    launchCheckout,
    cancel,
    reset,
  };
}
