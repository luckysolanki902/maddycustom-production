'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { updateProgress, completeNavigation, cancelNavigation } from '@/store/slices/navigationSlice';
import { useNavigationDetection } from './NavigationDetectionManager';

const TopLoadingBar = () => {
  const dispatch = useDispatch();
  const { isLoading, progress, loadingActive } = useSelector(state => state.navigation);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const progressRef = useRef(0);

  // Initialize navigation detection
  useNavigationDetection();

  // Ultra-fast progress simulation
  const simulateProgress = useCallback(() => {
    if (!loadingActive) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start with immediate progress
    let currentProgress = 30;
    progressRef.current = currentProgress;
    dispatch(updateProgress(currentProgress));

    // Very aggressive progress updates
    intervalRef.current = setInterval(() => {
      if (!loadingActive) {
        clearInterval(intervalRef.current);
        return;
      }

      // Exponential slowdown as we approach 95%
      const increment = currentProgress < 50 
        ? Math.random() * 15 + 10  // 10-25% increments early
        : currentProgress < 75
        ? Math.random() * 10 + 5   // 5-15% increments middle
        : Math.random() * 5 + 2;   // 2-7% increments late

      currentProgress = Math.min(currentProgress + increment, 95);
      progressRef.current = currentProgress;
      
      dispatch(updateProgress(currentProgress));

      // Stop at 95% and wait for completion
      if (currentProgress >= 95) {
        clearInterval(intervalRef.current);
      }
    }, 30); // Ultra-fast 30ms updates for smooth animation

  }, [dispatch, loadingActive]);

  // Safety timeout to prevent stuck loading bar
  const setSafetyTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Auto-complete after 10 seconds if stuck
    timeoutRef.current = setTimeout(() => {
      console.warn('⚠️ Navigation loading timeout - auto-completing');
      dispatch(completeNavigation());
    }, 10000);
  }, [dispatch]);

  // Start progress simulation when loading begins
  useEffect(() => {
    if (isLoading && loadingActive) {
      simulateProgress();
      setSafetyTimeout();
    } else {
      // Clear interval when loading stops
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, loadingActive, simulateProgress, setSafetyTimeout]);

  // Handle completion with fade-out
  useEffect(() => {
    if (progress === 100 && !loadingActive) {
      // Small delay to show 100% before hiding
      const fadeTimeout = setTimeout(() => {
        // Reset progress after fade-out animation
        dispatch(updateProgress(0));
      }, 200);

      return () => clearTimeout(fadeTimeout);
    }
  }, [progress, loadingActive, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <>
          {/* Background blur overlay for premium feel */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }} // Faster appearance
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              background: 'linear-gradient(180deg, rgba(45,45,45,0.08) 0%, rgba(45,45,45,0.02) 100%)',
              zIndex: 1599,
              backdropFilter: 'blur(3px)'
            }}
          />
          
          {/* Main loading bar */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ 
              opacity: 0, 
              scaleX: 0.95,
              transition: { duration: 0.15 }
            }}
            transition={{ 
              scaleX: { duration: 0.08, ease: "easeOut" }, // Faster appearance
              opacity: { duration: 0.06 }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              zIndex: 1600,
              transformOrigin: 'left',
              background: '#f8f9fa',
              boxShadow: '0 1px 4px rgba(45, 45, 45, 0.12)',
              overflow: 'hidden'
            }}
          >
            {/* Animated progress bar with gradient */}
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ 
                duration: 0.05, // Ultra-fast transitions
                ease: [0.23, 1, 0.32, 1] // Smooth easing
              }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #2d2d2d 0%, #495057 50%, #6c757d 100%)',
                borderRadius: '0 2px 2px 0',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(45,45,45,0.15)'
              }}
            >
              {/* Ultra-fast shimmer effect */}
              <motion.div
                animate={{ x: ['-150%', '350%'] }}
                transition={{
                  duration: 0.6, // Faster shimmer
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 0.1
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '50%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  borderRadius: '2px'
                }}
              />
              
              {/* Pulsing glow effect */}
              <motion.div
                animate={{ 
                  opacity: [0.2, 0.6, 0.2],
                  scale: [1, 1.04, 1]
                }}
                transition={{
                  duration: 0.8, // Faster pulse
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

              {/* Leading edge highlight */}
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  height: '100%',
                  width: '8px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 100%)',
                  borderRadius: '0 2px 2px 0'
                }}
              />
            </motion.div>
            
            {/* Racing sparkle effects */}
            <motion.div
              animate={{ 
                x: ['-80px', `${typeof window !== 'undefined' ? window.innerWidth + 80 : 1280}px`] 
              }}
              transition={{
                duration: 1.5, // Faster racing sparkles
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '4px',
                height: '4px',
                background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, transparent 70%)',
                borderRadius: '50%',
                boxShadow: '0 0 8px rgba(255,255,255,0.8), 0 0 4px rgba(26,115,232,0.6)'
              }}
            />

            {/* Secondary sparkle */}
            <motion.div
              animate={{ 
                x: ['-120px', `${typeof window !== 'undefined' ? window.innerWidth + 120 : 1320}px`] 
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                delay: 0.3
              }}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2px',
                height: '2px',
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
            transition={{ duration: 0.1, delay: 0.02 }}
            style={{
              position: 'fixed',
              top: '3px',
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(26,115,232,0.4) 50%, transparent 100%)',
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