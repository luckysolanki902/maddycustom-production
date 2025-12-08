'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import Script from 'next/script';

/**
 * Google Customer Reviews survey opt-in component.
 * Displays an opt-in survey after order completion.
 * Only renders if email is available (email is optional for users).
 * 
 * @param {Object} props
 * @param {string} props.orderId - The order ID
 * @param {string} props.email - Customer email address (optional)
 * @param {string} props.countryCode - Country code (default: 'IN' for India)
 * @param {Date|string} props.estimatedDeliveryDate - Estimated delivery date
 */
export default function GoogleCustomerReviews({
  orderId,
  email,
  countryCode = 'IN',
  estimatedDeliveryDate,
}) {
  const renderedRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  // Check if we have required data
  const hasRequiredData = Boolean(orderId && email);

  // Safely calculate estimated delivery date
  const formattedDeliveryDate = useMemo(() => {
    try {
      let deliveryDate;
      if (estimatedDeliveryDate) {
        deliveryDate = new Date(estimatedDeliveryDate);
        // Check if date is valid
        if (isNaN(deliveryDate.getTime())) {
          deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      } else {
        deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      return deliveryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      // Fallback: 7 days from now
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  }, [estimatedDeliveryDate]);

  const renderSurvey = useCallback(() => {
    // Safety checks
    if (!hasRequiredData) return;
    if (renderedRef.current) return;
    if (!scriptLoadedRef.current) return;
    if (typeof window === 'undefined') return;
    if (!window.gapi?.surveyoptin?.render) return;

    renderedRef.current = true;

    try {
      window.gapi.surveyoptin.render({
        merchant_id: '5524548791',
        order_id: String(orderId),
        email: String(email),
        delivery_country: countryCode || 'IN',
        estimated_delivery_date: formattedDeliveryDate,
      });
    } catch (error) {
      // Silently fail - don't block UI
      console.warn('[GoogleCustomerReviews] Failed to render survey:', error);
      renderedRef.current = false; // Allow retry
    }
  }, [hasRequiredData, orderId, email, countryCode, formattedDeliveryDate]);

  useEffect(() => {
    // Only run on client side and if we have data
    if (typeof window === 'undefined') return;
    if (!hasRequiredData) return;
    
    // Try to render if script is already loaded (e.g., from cache)
    if (window.gapi?.surveyoptin?.render) {
      scriptLoadedRef.current = true;
      renderSurvey();
    }
  }, [hasRequiredData, renderSurvey]);

  const handleScriptLoad = useCallback(() => {
    scriptLoadedRef.current = true;
    // Small delay to ensure gapi is fully initialized
    setTimeout(() => {
      renderSurvey();
    }, 100);
  }, [renderSurvey]);

  const handleScriptError = useCallback(() => {
    // Silently fail - don't block UI or show errors to user
    console.warn('[GoogleCustomerReviews] Failed to load Google script');
  }, []);

  // Don't render script if required data is missing
  if (!hasRequiredData) {
    return null;
  }

  return (
    <Script
      id="google-customer-reviews"
      src="https://apis.google.com/js/platform.js"
      strategy="lazyOnload"
      onLoad={handleScriptLoad}
      onError={handleScriptError}
    />
  );
}
