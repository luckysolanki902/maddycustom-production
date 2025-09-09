'use client';

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { completeNavigation } from '@/store/slices/navigationSlice';
import Image from 'next/image';

const FullPageLoader = () => {
  const dispatch = useDispatch();
  const { isLoading, loadingActive } = useSelector(state => state.navigation);
  const timeoutRef = useRef(null);

  // Safety timeout to prevent stuck loading
  useEffect(() => {
    if (isLoading && loadingActive) {
      // Auto-complete after 10 seconds if stuck
      timeoutRef.current = setTimeout(() => {
        console.warn('⚠️ Full page loading timeout - auto-completing');
        dispatch(completeNavigation());
      }, 10000);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, loadingActive, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isLoading && loadingActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.2,
            exit: { duration: 0.3, ease: "easeOut" }
          }}
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '99999',
            position: 'fixed',
            top: '0',
            left: '0',
            backgroundColor: 'white',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ 
              duration: 0.3, 
              ease: "easeOut",
              exit: { duration: 0.2 }
            }}
          >
            <Image
              src={'/images/assets/gifs/helmetloadinggif.gif'}
              width={667}
              height={667}
              priority
              loading='eager'
              style={{
                width: '350px',
                height: 'auto',
                objectFit: 'cover',
              }}
              alt={'loading'}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPageLoader;
