// contexts/ScrollContext.js
'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ScrollContext = createContext();

export const useScrollContext = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollContext must be used within a ScrollProvider');
  }
  return context;
};

export const ScrollProvider = ({ children }) => {
  const [scrollState, setScrollState] = useState({
    scrollY: 0,
    isScrollingDown: false,
    isHidden: false,
    isSticky: false,
    velocity: 0
  });

  const prevScrollY = useRef(0);
  const lastTime = useRef(Date.now());
  const ticking = useRef(false);

  useEffect(() => {
    const HIDE_THRESHOLD = 40; // Lower threshold for faster response
    const STICKY_THRESHOLD = 5;
    const MIN_VELOCITY = 0.2; // Lower velocity requirement
    const MIN_SCROLL_DELTA = 3; // Minimum scroll distance

    const handleScroll = () => {
      if (ticking.current) return;
      
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const timeDelta = currentTime - lastTime.current;
        
        // Calculate velocity for smooth responsiveness
        const scrollDelta = currentScrollY - prevScrollY.current;
        const velocity = timeDelta > 0 ? Math.abs(scrollDelta / timeDelta) : 0;
        
        const isScrollingDown = scrollDelta > 0;
        const isSignificantScroll = Math.abs(scrollDelta) >= MIN_SCROLL_DELTA;
        
        // More aggressive hiding for that snappy feel
        const shouldHide = currentScrollY > HIDE_THRESHOLD && 
                          isScrollingDown && 
                          isSignificantScroll &&
                          velocity > MIN_VELOCITY;
        
        // Quick showing when scrolling up
        const shouldShow = (!isScrollingDown && isSignificantScroll) || 
                          currentScrollY <= HIDE_THRESHOLD;

        setScrollState(prev => {
          let isHidden = prev.isHidden;
          
          if (shouldHide) {
            isHidden = true;
          } else if (shouldShow) {
            isHidden = false;
          }

          return {
            scrollY: currentScrollY,
            isScrollingDown,
            isHidden,
            isSticky: currentScrollY > STICKY_THRESHOLD,
            velocity
          };
        });

        prevScrollY.current = currentScrollY;
        lastTime.current = currentTime;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <ScrollContext.Provider value={scrollState}>
      {children}
    </ScrollContext.Provider>
  );
};
