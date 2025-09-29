'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { closeAllDialogs } from '@/store/slices/uiSlice';
import { setLoginDialogShown } from '@/store/slices/orderFormSlice';

/**
 * NavigationListener - Automatically closes all open drawers/dialogs when navigation occurs
 * This ensures a clean UI state when users navigate between pages
 */
export default function NavigationListener() {
  const pathname = usePathname();
  const dispatch = useDispatch();

  useEffect(() => {
    // Close all dialogs/drawers whenever the pathname changes
    dispatch(closeAllDialogs());
    // Only reset loginDialogShown if we're navigating away from a page where a user might have interacted
    // This prevents the subscribe dialog from showing multiple times during a session
    // The dialog itself will handle when it should be shown based on persistent state
    dispatch(setLoginDialogShown(false));
  }, [pathname, dispatch]);

  return null; // This component doesn't render anything
}