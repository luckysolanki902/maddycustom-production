'use client';

import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName) {
  const startTime = useRef(Date.now());
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const mountTime = Date.now() - startTime.current;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚡ ${componentName} mounted in ${mountTime}ms`);
        
        // Log if it's taking too long
        if (mountTime > 100) {
          console.warn(`⚠️ ${componentName} slow mount: ${mountTime}ms`);
        }
      }
    }
  }, [componentName]);

  return {
    measureFetch: (fetchName) => {
      const fetchStart = Date.now();
      return () => {
        const fetchTime = Date.now() - fetchStart;
        if (process.env.NODE_ENV === 'development') {
          console.log(`📡 ${componentName} ${fetchName}: ${fetchTime}ms`);
        }
      };
    }
  };
}
