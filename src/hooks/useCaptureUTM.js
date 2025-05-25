// src/hooks/useCaptureUTM.js

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { setUTMDetails } from '@/store/slices/utmSlice';

const useCaptureUTM = () => {
    const searchParams = useSearchParams();
    const dispatch = useDispatch();
    const { utmDetails, isSet } = useSelector((state) => state.utm);
    const hasCaptured = useRef(false); // To ensure capture only once

    useEffect(() => {
        try {
            // Check if utm_override exists and is set to 'true'
            const utmOverride = searchParams.get('utm_override') === 'true';
            
            // Skip if already captured and no override, or if isSet and no override
            if ((hasCaptured.current || isSet) && !utmOverride) {
                return;
            }

            // Define all UTM and Facebook parameters you want to capture
            const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbc'];
            const capturedUTM = {};

            utmParams.forEach((param) => {
                const value = searchParams.get(param);
                if (value) {
                    const key = param === 'fbc' ? 'fbc' : param.replace('utm_', '');
                    capturedUTM[key] = value;
                }
            });

            if (Object.keys(capturedUTM).length > 0) {
                // If utm_override is true, always update UTM details
                // Otherwise, only update if there's a difference and not already set
                const isDifferent = Object.keys(capturedUTM).some(
                    (key) => utmDetails[key] !== capturedUTM[key]
                );

                if (utmOverride || (!isSet && isDifferent)) {
                    dispatch(setUTMDetails({ 
                        ...capturedUTM, 
                        override: utmOverride // Store override information
                    }));
                    hasCaptured.current = true; // Mark as captured

                    // Store in cookies for later use in server-side events
                    Object.keys(capturedUTM).forEach((key) => {
                        document.cookie = `${key}=${encodeURIComponent(capturedUTM[key])}; path=/; max-age=31536000`; // 1 year
                    });

                    // Remove UTM parameters from URL after capturing to keep URLs clean
                    const cleanUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, document.title, cleanUrl);
                }
            }
        } catch (error) {
            console.error('Error capturing UTM/FBC parameters:', error);
            // Do not overwrite existing UTM details if an error occurs
        }
    }, [searchParams, dispatch, utmDetails, isSet]);
};

export default useCaptureUTM;
