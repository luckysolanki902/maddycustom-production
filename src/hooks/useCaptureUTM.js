// src/hooks/useCaptureUTM.js

import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { setUTMDetails } from '@/store/slices/utmSlice';

// List of UTM and Facebook parameters we want to track
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbc'];

const useCaptureUTM = () => {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const dispatch = useDispatch();
    const { utmDetails, isSet } = useSelector((state) => state.utm);
    const lastURLChecked = useRef(''); // Keep track of the last URL we checked
    const lastUtmParamsRef = useRef({}); // Track the last set of UTM params

    useEffect(() => {
        try {
            // Get current URL with query params as string
            const urlString = pathname + '?' + Array.from(searchParams).map(([k, v]) => `${k}=${v}`).join('&');
            
            // Skip if this exact URL was already processed
            if (lastURLChecked.current === urlString) {
                return;
            }

            // Update our reference to the current URL
            lastURLChecked.current = urlString;
            
            // Check if utm_override exists and is set to 'true'
            const utmOverride = searchParams.get('utm_override') === 'true';
            
            // Get all UTM parameters from the URL
            const capturedUTM = {};
            const otherQueryParams = {};

            // Capture UTM parameters
            UTM_PARAMS.forEach((param) => {
                const value = searchParams.get(param);
                if (value) {
                    const key = param === 'fbc' ? 'fbc' : param.replace('utm_', '');
                    capturedUTM[key] = value;
                }
            });

            // Capture non-UTM parameters
            // Convert searchParams iterator to array of entries and process
            Array.from(searchParams.entries()).forEach(([key, value]) => {
                // Skip UTM parameters and utm_override
                if (!UTM_PARAMS.includes(key) && key !== 'utm_override') {
                    otherQueryParams[key] = value;
                }
            });

            // Check if we found any UTM parameters
            const hasUtmParams = Object.keys(capturedUTM).length > 0;

            if (hasUtmParams) {
                // Has the set of UTM params changed from what we've seen before?
                const isDifferent = !lastUtmParamsRef.current || 
                    Object.keys(capturedUTM).some(key => 
                        capturedUTM[key] !== lastUtmParamsRef.current[key]
                    );

                // Update our reference to the current UTM parameters
                lastUtmParamsRef.current = { ...capturedUTM };

                // Dispatch action to update UTM history and/or main UTM details
                // The reducer will handle whether to update the main UTM details based on override flag
                if (isDifferent) {
                    dispatch(setUTMDetails({ 
                        ...capturedUTM, 
                        override: utmOverride, // Temporary flag for the reducer, not stored
                        pathname: pathname, 
                        queryParams: Object.keys(otherQueryParams).length > 0 ? otherQueryParams : null
                    }));
                    
                    // Store in cookies for later use in server-side events
                    Object.keys(capturedUTM).forEach((key) => {
                        document.cookie = `${key}=${encodeURIComponent(capturedUTM[key])}; path=/; max-age=31536000`; // 1 year
                    });
                }

                // Clean up URL by removing UTM parameters
                if (Object.keys(otherQueryParams).length > 0) {
                    const cleanQueryString = Object.entries(otherQueryParams)
                        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                        .join('&');
                        
                    const newUrl = `${pathname}?${cleanQueryString}`;
                    window.history.replaceState({}, document.title, newUrl);
                } else {
                    // No other query params, just use pathname
                    window.history.replaceState({}, document.title, pathname);
                }
            }
        } catch (error) {
            console.error('Error capturing UTM/FBC parameters:', error);
        }
    }, [searchParams, pathname, dispatch, isSet]);
};

export default useCaptureUTM;
