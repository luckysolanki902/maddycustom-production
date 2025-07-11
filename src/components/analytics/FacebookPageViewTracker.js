'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { pageView } from '@/lib/metadata/facebookPixels';

/**
 * Component to automatically track PageView events to Facebook Conversion API
 * This ensures that PageView events include fbc and fbp parameters
 */
const FacebookPageViewTracker = () => {
  const pathname = usePathname();
  const trackedPages = useRef(new Set());

  useEffect(() => {
    // Function to track page view
    const trackPageView = async () => {
      try {
        const currentUrl = window.location.href;
        
        // Avoid tracking the same page multiple times in a short period
        if (trackedPages.current.has(currentUrl)) {
          return;
        }

        // Add to tracked pages
        trackedPages.current.add(currentUrl);

        // Clear old entries to prevent memory leaks (keep only last 10 pages)
        if (trackedPages.current.size > 10) {
          const entries = Array.from(trackedPages.current);
          trackedPages.current.clear();
          entries.slice(-5).forEach(url => trackedPages.current.add(url));
        }

        // Track the page view with server-side Conversion API
        await pageView({}, {
          content_name: document.title,
          content_category: 'page',
          content_type: 'website',
          event_source_url: currentUrl,
        });

        console.log('PageView tracked to Conversion API for:', currentUrl);
      } catch (error) {
        console.error('Error tracking PageView:', error);
      }
    };

    // Small delay to ensure cookies are set and DOM is ready
    const timeoutId = setTimeout(trackPageView, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [pathname]); // Re-run when pathname changes

  return null; // This component doesn't render anything
};

export default FacebookPageViewTracker;
