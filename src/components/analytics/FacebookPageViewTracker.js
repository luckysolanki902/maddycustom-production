'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageView } from '@/lib/metadata/facebookPixels';

/**
 * Component to automatically track PageView events to Facebook Conversion API
 * This ensures that PageView events include fbc and fbp parameters
 */
const FacebookPageViewTracker = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams ? searchParams.toString() : '';
  const trackedPages = useRef(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const currentUrl = window.location.href;
    const pageTitle = document.title;
    const alreadyTracked = trackedPages.current.has(currentUrl);
    let hasDispatched = false;
    let cancelled = false;
    let cancelScheduled = () => {};
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    const trimHistory = () => {
      if (trackedPages.current.size <= 25) return;
      const entries = Array.from(trackedPages.current);
      trackedPages.current = new Set(entries.slice(entries.length - 15));
    };

    const dispatchPageView = async () => {
      if (hasDispatched || cancelled) {
        return;
      }

      if (alreadyTracked) {
        hasDispatched = true;
        return;
      }

      hasDispatched = true;
      trackedPages.current.add(currentUrl);
      attempts += 1;

      try {
        await pageView({}, {
          content_name: pageTitle,
          content_category: 'page',
          content_type: 'website',
          event_source_url: currentUrl,
        });
        trimHistory();
      } catch (error) {
        console.error('Error tracking PageView:', error);
        trackedPages.current.delete(currentUrl);
        if (!cancelled && attempts < MAX_ATTEMPTS) {
          hasDispatched = false;
          cancelScheduled = () => {};
          window.setTimeout(() => {
            if (!cancelled) {
              dispatchPageView();
            }
          }, 800);
        }
      }
    };

    const scheduleDispatch = () => {
      if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(() => {
          dispatchPageView();
        }, { timeout: 1500 });
        cancelScheduled = () => {
          if (typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(idleId);
          }
        };
      } else {
        const timeoutId = window.setTimeout(() => {
          dispatchPageView();
        }, 250);
        cancelScheduled = () => window.clearTimeout(timeoutId);
      }
    };

    scheduleDispatch();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        dispatchPageView();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelScheduled();
      if (!hasDispatched) {
        dispatchPageView();
      }
      cancelled = true;
    };
  }, [pathname, searchKey]);

  return null; // This component doesn't render anything
};

export default FacebookPageViewTracker;
