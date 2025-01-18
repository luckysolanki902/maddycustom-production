// @/components/utils/TimeTracker.js

'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { incrementTimeSpent } from '@/store/slices/userBehaviorSlice';
import { usePathname } from 'next/navigation';

const TimeTracker = () => {
  const dispatch = useDispatch();
  const loginDialogShown = useSelector((state) => state.orderForm.loginDialogShown);
  const userExists = useSelector((state) => state.orderForm.userExists);
  const pathname = usePathname();

  useEffect(() => {
    // Start the timer only if the dialog hasn't been shown, user doesn't exist, and not on /viewcart
    if (loginDialogShown || userExists || pathname === '/viewcart') return;

    const timer = setInterval(() => {
      dispatch(incrementTimeSpent());
    }, 1000); // Increment every second

    return () => clearInterval(timer);
  }, [dispatch, loginDialogShown, userExists, pathname]);

  return null; // This component doesn't render anything
};

export default TimeTracker;
