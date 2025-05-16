'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { openCartDrawer } from '@/store/slices/uiSlice';

const CartInitializer = () => {
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  
  useEffect(() => {
    // Check if we need to open the cart drawer
    if (searchParams.get('openCart') === 'true') {
      // For direct URL access, open from bottom
      dispatch(openCartDrawer({ source: 'bottom' }));
      
      // Clean up the URL by removing the query parameter (optional)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('openCart');
        window.history.replaceState({}, '', url);
      }
    }
  }, [searchParams, dispatch]);
  
  return null;
};

export default CartInitializer;
