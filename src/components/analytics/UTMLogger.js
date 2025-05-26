'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logUtmDetails } from '@/store/slices/utmSlice';

const UTMLogger = () => {
  const dispatch = useDispatch();
  const { utmDetails, isSet } = useSelector((state) => state.utm);
  
  useEffect(() => {
    // Log UTM details when the component mounts and when UTM details change
    if (isSet) {
      dispatch(logUtmDetails());
    }
  }, [dispatch, utmDetails, isSet]);

  return null; // This component does not render anything
};

export default UTMLogger;
