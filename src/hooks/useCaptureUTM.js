// src/hooks/useCaptureUTM.js

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { setUTMDetails } from '@/store/slices/utmSlice';

const useCaptureUTM = () => {
    const searchParams = useSearchParams();
    const dispatch = useDispatch();
    const utmDetails = useSelector((state) => state.utm.utmDetails);
    const hasCaptured = useRef(false); // To ensure capture only once

    useEffect(() => {


        if (hasCaptured.current) {
            return;
        }

        try {
            // Define all UTM parameters you want to capture
            const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
            const capturedUTM = {};

            utmParams.forEach((param) => {
                const value = searchParams.get(param);
                if (value) {
                    const key = param.replace('utm_', '');
                    capturedUTM[key] = value;
                }
            });

            if (Object.keys(capturedUTM).length > 0) {

                // Check if captured UTM differs from current state to avoid redundant dispatch
                const isDifferent = Object.keys(capturedUTM).some(
                    (key) => utmDetails[key] !== capturedUTM[key]
                );

                if (isDifferent) {
                    dispatch(setUTMDetails(capturedUTM));
                    hasCaptured.current = true; // Mark as captured

                    // Remove UTM parameters from URL after capturing to keep URLs clean
                    const cleanUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, document.title, cleanUrl);
                } else {
                }
            } else {
            }
        } catch (error) {
            console.error('Error capturing UTM parameters:', error);
            // Do not overwrite existing UTM details if an error occurs
        }
    }, [searchParams, dispatch, utmDetails]);
};

export default useCaptureUTM;
