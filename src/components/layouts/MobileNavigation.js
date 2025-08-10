// components/layouts/MobileNavigation.js
'use client';

import React from 'react';
import { useScrollNavigation } from '@/hooks/useScrollNavigation';
import { useSpring, animated } from 'react-spring';
import Topbar from './Topbar';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import { useMediaQuery } from '@mui/material';

/**
 * MobileNavigation - A unified component that handles the synchronized
 * animation of topbar and search box for mobile devices.
 * This creates that smooth, addictive scrolling experience where
 * they move as a single unit.
 */
const MobileNavigation = () => {
  const isMobile = useMediaQuery("(max-width: 1000px)");
  const { topbarOffset, searchOffset, isMounted, isSticky } = useScrollNavigation();

  // Enhanced spring configuration for that buttery smooth feel
  const topbarAnimation = useSpring({
    transform: `translateY(${topbarOffset}px)`,
    config: { 
      tension: 320, 
      friction: 28,
      velocity: 0.1
    },
    immediate: !isMounted
  });

  const searchAnimation = useSpring({
    transform: `translateY(${searchOffset}px)`,
    config: { 
      tension: 320, 
      friction: 28,
      velocity: 0.1
    },
    immediate: !isMounted
  });

  if (!isMobile) {
    // On desktop, just render the normal topbar
    return <Topbar />;
  }

  return (
    <>
      {/* Topbar with synchronized animation */}
      <animated.div style={topbarAnimation}>
        <Topbar isAnimated={false} /> {/* Pass flag to prevent double animation */}
      </animated.div>
      
      {/* Search box with synchronized animation */}
      <animated.div style={searchAnimation}>
        <CategorySearchBox isAnimated={false} /> {/* Pass flag to prevent double animation */}
      </animated.div>
    </>
  );
};

export default MobileNavigation;
