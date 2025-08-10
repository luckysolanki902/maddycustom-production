'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Typewriter from 'typewriter-effect';
import { useDispatch } from 'react-redux';
import { openSearchDialog } from '@/store/slices/uiSlice';
import { useMediaQuery } from '@mui/material';
import searchStyles from './styles/categorysearchbox.module.css';
import { typewriterStrings } from '@/lib/constants/typewriterCategories';
import { useSpring, animated } from 'react-spring';
import { useScrollContext } from '@/contexts/ScrollContext';

export default function CategorySearchBox() {
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const [searchText, setSearchText] = useState('');
  
  // This hook returns true on screens up to 1000px wide
  const isMobile = useMediaQuery("(max-width: 1000px)");

  // Use shared scroll context for perfect synchronization
  const { isHidden, isSticky } = useScrollContext();

  // When topbar is hidden, search box moves to the top
  const animationProps = useSpring({
    transform: isHidden ? 'translateY(-60px)' : 'translateY(0px)', // -60px = exact topbar height
    config: { 
      tension: 280, 
      friction: 30,
      clamp: true // Prevents overshoot for crisp animation
    }
  });

  // Hide component on larger screens
  if (!isMobile) return null;

  const handleFocus = () => {
    dispatch(openSearchDialog());
  };

  return (
    <animated.div 
      className={`${searchStyles.searchBoxWrapper} ${isSticky ? searchStyles.sticky : ''}`}
      style={animationProps}
    >
      <div className={searchStyles.containerBackground}>
        <div className={searchStyles.searchBox}>
          <div className={searchStyles.searchBoxInner} onClick={handleFocus}>
            <span className={searchStyles.searchIcon}>
              <div className="searchIcon">
                <Image
                  src={`${baseUrl}/assets/icons/search.png`}
                  width={24}
                  height={24}
                  alt="search icon"
                />
              </div>
            </span>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                background: 'transparent',
              }}
            >
              {searchText === '' && (
                <div style={{ color: '#555' }}>
                  <Typewriter
                    options={{
                      strings: typewriterStrings,
                      autoStart: true,
                      loop: true,
                      delay: 40,
                      deleteSpeed: 10,
                    }}
                  />
                </div>
              )}

              <div
                type="text"
                spellCheck="false"
                value={searchText}
                className={`${searchStyles.inputField} ${searchStyles.inputFieldLimited}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </animated.div>
  );
}
