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
    console.log('TimeTracker mounted:', {
      userExists,
      pathname,
      initialTimeSpent: timeSpentOnWebsite
    });
  }, [userExists, pathname, timeSpentOnWebsite]);

  // Log time every 5 seconds for debugging
  useEffect(() => {
    const logTimer = setInterval(() => {
      if (timeSpentOnWebsite > 0) {
        console.log('TimeTracker: Current time spent:', timeSpentOnWebsite, 'seconds');
      }
    }, 5000);

    return () => clearInterval(logTimer);
  }, [timeSpentOnWebsite]);

  useEffect(() => {
    // Start the timer only if user doesn't exist and not on /viewcart
    // Removed loginDialogShown to avoid circular dependency with SubscribeDialog
    if (userExists || pathname === '/viewcart') {
      console.log('TimeTracker: Not starting - userExists:', userExists, 'pathname:', pathname);
      return;
    }

    console.log('TimeTracker: Starting timer');
    const timer = setInterval(() => {
      dispatch(incrementTimeSpent());
    }, 1000); // Increment every second

    return () => {
      console.log('TimeTracker: Stopping timer');
      clearInterval(timer);
    };
  }, [dispatch, userExists, pathname]);

  return null; // This component doesn't render anything
};

export default TimeTracker;
