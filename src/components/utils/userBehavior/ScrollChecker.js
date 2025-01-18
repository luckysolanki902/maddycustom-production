// @/components/utils/userBehavior/ScrollChecker.js

'use client';

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setScrolledMoreThan60Percent } from '@/store/slices/userBehaviorSlice';
import { usePathname } from 'next/navigation';
import debounce from 'lodash.debounce';

const ScrollChecker = () => {
  const dispatch = useDispatch();
  const scrolledMoreThan60Percent = useSelector((state) => state.userBehavior.scrolledMoreThan60Percent);
  const pathname = usePathname();

  const checkScroll = () => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (docHeight <= windowHeight) {
      // Page is not scrollable
      console.log('Page is not scrollable.');
      dispatch(setScrolledMoreThan60Percent(false));
      return;
    }

    const totalScrollable = docHeight - windowHeight;
    const scrollPercentage = (scrollY / totalScrollable) * 100;

    console.log({
      scrollPercentage: scrollPercentage.toFixed(2),
      scrollY,
      windowHeight,
      docHeight,
      totalScrollable,
      totalScrolled: scrollY + windowHeight,
    });

    if (scrollPercentage > 60) {
      if (!scrolledMoreThan60Percent) {
        dispatch(setScrolledMoreThan60Percent(true));
        console.log('Scrolled more than 60%.');
      }
    }
  };

  const debouncedHandleScroll = debounce(checkScroll, 200);

  useEffect(() => {
    // Do not track scroll on /viewcart
    if (pathname === '/viewcart') return;

    window.addEventListener('scroll', debouncedHandleScroll);

    // Initial check in case user already scrolled enough before the effect runs
    checkScroll();

    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
      debouncedHandleScroll.cancel(); // Cancel any pending debounced calls
    };
  }, [debouncedHandleScroll, pathname]);

  return null;
};

export default ScrollChecker;
