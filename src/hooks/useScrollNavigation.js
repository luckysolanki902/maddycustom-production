// hooks/useScrollNavigation.js
'use client';

import { useState, useEffect, useRef } from 'react';

export const useScrollNavigation = () => {
  const [scrollState, setScrollState] = useState({
    currentScrollY: 0,
    prevScrollY: 0,
    isScrollingDown: false,
    isVisible: true,
    isSticky: false,
    topbarOffset: 0,
    searchOffset: 0
  });

  const isMounted = useRef(false);
  const ticking = useRef(false);
  const scrollVelocity = useRef(0);
  const lastScrollTime = useRef(Date.now());

  useEffect(() => {
    const TOPBAR_HEIGHT = 60; // Height of topbar
    const SCROLL_THRESHOLD = 60; // Lower threshold for faster response
    const STICKY_THRESHOLD = 5; // When to show sticky shadow
    const VELOCITY_THRESHOLD = 0.5; // Minimum velocity to trigger hiding

    const handleScroll = () => {
      if (ticking.current) return;
      
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const timeDelta = currentTime - lastScrollTime.current;
        
        // Calculate scroll velocity for more responsive feel
        const scrollDelta = currentScrollY - scrollState.prevScrollY;
        scrollVelocity.current = timeDelta > 0 ? Math.abs(scrollDelta / timeDelta) : 0;
        
        const isScrollingDown = scrollDelta > 0;
        const isSignificantScroll = Math.abs(scrollDelta) > 2; // Ignore tiny movements
        const hasEnoughVelocity = scrollVelocity.current > VELOCITY_THRESHOLD;
        
        let topbarOffset = 0;
        let searchOffset = 0;
        let isVisible = true;

        // More sophisticated logic for that addictive feel
        if (currentScrollY > SCROLL_THRESHOLD && 
            isScrollingDown && 
            isSignificantScroll && 
            hasEnoughVelocity) {
          // Hide topbar, move search to top with smooth easing
          topbarOffset = -TOPBAR_HEIGHT;
          searchOffset = -TOPBAR_HEIGHT;
          isVisible = false;
        } else if ((!isScrollingDown && isSignificantScroll) || 
                   currentScrollY <= SCROLL_THRESHOLD) {
          // Show both components
          topbarOffset = 0;
          searchOffset = 0;
          isVisible = true;
        } else {
          // Maintain current state for smooth transitions
          topbarOffset = scrollState.topbarOffset;
          searchOffset = scrollState.searchOffset;
          isVisible = scrollState.isVisible;
        }

        setScrollState({
          currentScrollY,
          prevScrollY: currentScrollY,
          isScrollingDown,
          isVisible,
          isSticky: currentScrollY > STICKY_THRESHOLD,
          topbarOffset,
          searchOffset
        });

        lastScrollTime.current = currentTime;
        ticking.current = false;
      });
    };

    // Set mounted flag
    isMounted.current = true;
    
    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { 
      passive: true,
      capture: false 
    });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollState.prevScrollY, scrollState.topbarOffset, scrollState.searchOffset, scrollState.isVisible]);

  return {
    ...scrollState,
    isMounted: isMounted.current
  };
};
