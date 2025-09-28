// @/components/utils/userBehavior/ScrollChecker.js

'use client';

import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setScrolledMoreThan60Percent } from '@/store/slices/userBehaviorSlice';
import { usePathname } from 'next/navigation';
import debounce from 'lodash.debounce';

const ScrollChecker = () => {
  const dispatch = useDispatch();
  const scrolledMoreThan60Percent = useSelector((state) => state.userBehavior.scrolledMoreThan60Percent);
  const pathname = usePathname();

  const checkScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (docHeight <= windowHeight) {
      // Page is not scrollable
      dispatch(setScrolledMoreThan60Percent(false));
      return;
    }

    const totalScrollable = docHeight - windowHeight;
    const scrollPercentage = (scrollY / totalScrollable) * 100;

    if (scrollPercentage > 60) {
      if (!scrolledMoreThan60Percent) {
        console.log('ScrollChecker: User scrolled more than 60%', { scrollPercentage: Math.round(scrollPercentage) });
        dispatch(setScrolledMoreThan60Percent(true));
      }
    }
  }, [dispatch, scrolledMoreThan60Percent]);

  useEffect(() => {
    // Do not track scroll on /viewcart
    if (pathname === '/viewcart') return;

    const debouncedHandleScroll = debounce(checkScroll, 200);
    
    window.addEventListener('scroll', debouncedHandleScroll);

    // Initial check in case user already scrolled enough before the effect runs
    checkScroll();

    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
      debouncedHandleScroll.cancel(); // Cancel any pending debounced calls
    };
  }, [checkScroll, pathname]);

  return null;
};

export default ScrollChecker;
