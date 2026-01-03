"use client";
// /components/commonComps/HalfBikes.js
import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSpring, animated } from 'react-spring';
import styles from '@/styles/home.module.css';

const HalfBikes = () => {
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

    // References for the images
    const refHalfImage1 = useRef(null);
    const refHalfImage2 = useRef(null);

    // States to track visibility
    const [inViewHalfImage1, setInViewHalfImage1] = useState(false);
    const [inViewHalfImage2, setInViewHalfImage2] = useState(false);

    useEffect(() => {
        const observerOptions = {
            root: null,
            threshold: 0.1,
        };

        // Observer callback
        const observerCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.target === refHalfImage1.current) {
                    setInViewHalfImage1(entry.isIntersecting);
                }
                if (entry.target === refHalfImage2.current) {
                    setInViewHalfImage2(entry.isIntersecting);
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        const currentRef1 = refHalfImage1.current;
        const currentRef2 = refHalfImage2.current;

        if (currentRef1) observer.observe(currentRef1);
        if (currentRef2) observer.observe(currentRef2);

        return () => {
            if (currentRef1) observer.unobserve(currentRef1);
            if (currentRef2) observer.unobserve(currentRef2);
        };
    }, []);

    // Animations
    const animationHalfImage1 = useSpring({
        from: { transform: 'translateX(-100%)' },
        to: { transform: inViewHalfImage1 ? 'translateX(0)' : 'translateX(-100%)' },
    });

    const animationHalfImage2 = useSpring({
        from: { transform: 'translateX(100%)' },
        to: { transform: inViewHalfImage2 ? 'translateX(0)' : 'translateX(100%)' },
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div ref={refHalfImage1} className={styles.halfImage1}>
                <animated.div style={animationHalfImage1} className={styles.halfImageDiv}>
                    <Image
                        width={1091 / 2}
                        height={977 / 2}
                        alt="featured bike wrap"
                        src={`${baseImageUrl}/assets/others/down06.jpg`}
                        loading="eager"
                    />
                </animated.div>
            </div>

            <div ref={refHalfImage2} className={styles.halfImage2}>
                <animated.div style={animationHalfImage2} className={styles.halfImageDiv}>
                    <Image
                        width={1091 / 2}
                        height={977 / 2}
                        alt="featured bike wrap"
                        src={`${baseImageUrl}/assets/others/down05.jpg`}
                        loading="eager"
                    />
                </animated.div>
            </div>
        </div>
    );
};

export default HalfBikes;
