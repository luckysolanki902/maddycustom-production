'use client';

import { useEffect, useRef } from 'react';
import LoadingBar from 'react-top-loading-bar';
import { usePathname, useSearchParams } from 'next/navigation';

const TopLoadingBar = () => {
    const loadingBarRef = useRef(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isLoading = useRef(false);
    const timerRef = useRef(null);

    const MAX_LOADING_TIME = 5000; // Maximum loading time in milliseconds

    // Combine pathname and searchParams to create a unique key for each route change
    const currentRoute = `${pathname}?${searchParams.toString()}`;

    useEffect(() => {
        // Function to start the loading bar smoothly
        const startLoading = () => {
            if (loadingBarRef.current && !isLoading.current) {
                try {
                    loadingBarRef.current.continuousStart(15); // Slower initial step for smoother start
                    isLoading.current = true;

                    // Set a timeout to complete the loading bar after MAX_LOADING_TIME
                    timerRef.current = setTimeout(() => {
                        if (loadingBarRef.current) {
                            loadingBarRef.current.complete();
                        }
                        isLoading.current = false;
                        timerRef.current = null;
                    }, MAX_LOADING_TIME);
                } catch (error) {
                    console.error('Error starting the loading bar:', error);
                    // Attempt to complete the loading bar to prevent it from running indefinitely
                    if (loadingBarRef.current) {
                        loadingBarRef.current.complete();
                    }
                    isLoading.current = false;
                    timerRef.current = null;
                }
            }
        };

        // Function to stop the loading bar smoothly
        const stopLoading = () => {
            if (loadingBarRef.current && isLoading.current) {
                try {
                    loadingBarRef.current.complete();
                } catch (error) {
                    console.error('Error completing the loading bar:', error);
                }
                isLoading.current = false;

                // Clear the timeout if it's still active
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            }
        };

        // Start the loading bar when the route changes
        startLoading();

        // Stop the loading bar when the component unmounts or before the next effect runs
        return () => {
            stopLoading();
        };
    }, [currentRoute]); // Depend on the combined route

    // Handle loader completion to reset state and clear any active timers
    const handleLoaderFinished = () => {
        isLoading.current = false;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    return (
        <LoadingBar
            color='#000000'
            height={3}
            ref={loadingBarRef}
            waitingTime={50} // Slight delay for smoother visibility
            progressIncrease={10}
            onLoaderFinished={handleLoaderFinished}
            transitionTime={100}     
        />
    );
};

export default TopLoadingBar;
