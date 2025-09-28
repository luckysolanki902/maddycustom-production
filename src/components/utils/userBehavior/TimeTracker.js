// @/components/utils/TimeTracker.js

'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { incrementTimeSpent } from '@/store/slices/userBehaviorSlice';
import { usePathname } from 'next/navigation';

const TimeTracker = () => {
  const dispatch = useDispatch();
  const userExists = useSelector((state) => state.orderForm.userExists);
  const timeSpentOnWebsite = useSelector((state) => state.userBehavior.timeSpentOnWebsite);
  const pathname = usePathname();

  // Log initial state
  useEffect(() => {
    // initial state available if needed for debugging
  }, [userExists, pathname, timeSpentOnWebsite]);

  // Log time every 5 seconds for debugging
  useEffect(() => {
    const logTimer = setInterval(() => {
      // silent periodic check to keep hook reactive
    }, 5000);

    return () => clearInterval(logTimer);
  }, [timeSpentOnWebsite]);

  useEffect(() => {
    // Start the timer only if user doesn't exist and not on /viewcart
    // Removed loginDialogShown to avoid circular dependency with SubscribeDialog
    if (userExists || pathname === '/viewcart') {
      return;
    }

    const timer = setInterval(() => {
      dispatch(incrementTimeSpent());
    }, 1000); // Increment every second

    return () => {
      clearInterval(timer);
    };
  }, [dispatch, userExists, pathname]);

  return null; // This component doesn't render anything
};

export default TimeTracker;
