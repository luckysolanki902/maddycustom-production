'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const TopLoadingBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const isNavigatingRef = useRef(false);

  const startLoading = useCallback(() => {
    if (isNavigatingRef.current) return; // Prevent double triggers
    
    isNavigatingRef.current = true;
    
    // Clear any existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Start immediately with no delay
    setIsLoading(true);
    setProgress(30); // Immediate substantial progress
    
    // Very fast incremental progress
    let currentProgress = 30;
    intervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 8 + 2; // 2-10% increments
      if (currentProgress >= 95) {
        currentProgress = 95; // Cap at 95% until completion
        clearInterval(intervalRef.current);
      }
      setProgress(currentProgress);
    }, 50); // Very fast updates every 50ms
  }, []);

  const finishLoading = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Immediate completion
    setProgress(100);
    
    // Quick hide
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      isNavigatingRef.current = false;
    }, 150);
  }, []);

  // Enhanced router navigation detection
  useEffect(() => {
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;
    const originalForward = router.forward;

    // Override router methods to detect programmatic navigation
    router.push = (...args) => {
      startLoading();
      return originalPush.apply(router, args);
    };

    router.replace = (...args) => {
      startLoading();
      return originalReplace.apply(router, args);
    };

    router.back = (...args) => {
      startLoading();
      return originalBack.apply(router, args);
    };

    router.forward = (...args) => {
      startLoading();
      return originalForward.apply(router, args);
    };

    return () => {
      // Restore original methods
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
      router.forward = originalForward;
    };
  }, [router, startLoading]);

  // Route change detection - most reliable
  useEffect(() => {
    startLoading();
    
    // Quick finish simulation
    const timer = setTimeout(finishLoading, 200);
    
    return () => {
      clearTimeout(timer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname, searchParams, startLoading, finishLoading]);

  // Aggressive click detection for instant feedback
  useEffect(() => {
    const handleMouseDown = (e) => {
      const target = e.target;
      const link = target.closest('a[href], button[type="submit"], [role="button"], .MuiListItem-root, .MuiButton-root, .MuiIconButton-root');
      
      if (link) {
        const href = link.getAttribute('href');
        const isListItem = link.classList.contains('MuiListItem-root');
        const isButton = link.tagName === 'BUTTON' || link.classList.contains('MuiButton-root') || link.classList.contains('MuiIconButton-root');
        
        // Check if it's an internal navigation or interactive element
        if ((href && (href.startsWith('/') || href.startsWith(window.location.origin))) || isListItem || isButton) {
          startLoading();
        }
      }
    };

    const handleClick = (e) => {
      const target = e.target;
      const clickable = target.closest(`
        a[href], 
        button, 
        [role="button"], 
        .MuiListItem-root, 
        .MuiButton-root, 
        .MuiIconButton-root,
        .MuiMenuItem-root,
        [data-testid*="button"],
        [class*="button"],
        [class*="Button"],
        [class*="clickable"],
        [onclick]
      `);
      
      if (clickable) {
        startLoading();
      }
    };

    const handleFormSubmit = () => {
      startLoading();
    };

    // Use both mousedown and click for comprehensive coverage
    document.addEventListener('mousedown', handleMouseDown, { capture: true, passive: true });
    document.addEventListener('click', handleClick, { capture: true, passive: true });
    document.addEventListener('submit', handleFormSubmit, { capture: true, passive: true });
    
    // Also listen for popstate (back/forward buttons)
    const handlePopState = () => {
      startLoading();
    };
    window.addEventListener('popstate', handlePopState);

    // Listen for programmatic navigation (router.push calls)
    const handleRouterPush = () => {
      startLoading();
    };
    
    // Custom event for router navigation
    window.addEventListener('beforeunload', handleRouterPush);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('submit', handleFormSubmit, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleRouterPush);
    };
  }, [startLoading]);

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <>
          {/* Background blur overlay for premium feel */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 100%)',
              zIndex: 1599,
              backdropFilter: 'blur(2px)'
            }}
          />
          
          {/* Main loading bar */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0, scaleX: 0.8 }}
            transition={{ 
              scaleX: { duration: 0.12, ease: "easeOut" },
              opacity: { duration: 0.1 }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              zIndex: 1600,
              transformOrigin: 'left',
              background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Animated progress bar with gradient */}
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ 
                duration: 0.1, 
                ease: [0.25, 0.1, 0.25, 1] // Custom cubic bezier for addictive feel
              }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #424242 0%, #666666 25%, #888888 50%, #666666 75%, #424242 100%)',
                borderRadius: '0 2px 2px 0',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.2)'
              }}
            >
              {/* Primary shimmer effect */}
              <motion.div
                animate={{ x: ['-120%', '320%'] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 0.2
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '40%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                  borderRadius: '2px'
                }}
              />
              
              {/* Secondary glow effect */}
              <motion.div
                animate={{ 
                  opacity: [0.3, 0.8, 0.3],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '100%',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 100%)',
                  borderRadius: '2px'
                }}
              />
            </motion.div>
            
            {/* Trailing sparkle effects */}
            <motion.div
              animate={{ 
                x: ['-50px', `${typeof window !== 'undefined' ? window.innerWidth : 1200}px`] 
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '3px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)',
                borderRadius: '50%',
                boxShadow: '0 0 6px rgba(255,255,255,0.6)'
              }}
            />
          </motion.div>
          
          {/* Bottom accent line for premium feel */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.15, delay: 0.05 }}
            style={{
              position: 'fixed',
              top: '4px',
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(66,66,66,0.3) 50%, transparent 100%)',
              zIndex: 1600,
              transformOrigin: 'left'
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default TopLoadingBar;
