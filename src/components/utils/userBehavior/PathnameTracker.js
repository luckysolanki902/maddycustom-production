// @/components/utils/userBehavior/PathnameTracker.js

'use client';

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { addPathnameVisited } from '@/store/slices/userBehaviorSlice';
import { usePathname } from 'next/navigation';

const PathnameTracker = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      dispatch(addPathnameVisited(pathname));
      console.log(`Pathname visited: ${pathname}`);
    }
  }, [pathname, dispatch]);

  return null;
};

export default PathnameTracker;
