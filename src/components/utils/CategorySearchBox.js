'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Typewriter from 'typewriter-effect';
import { useDispatch } from 'react-redux';
import { openSearchDialog } from '@/store/slices/uiSlice';
import { useMediaQuery } from '@mui/material';
import searchStyles from './styles/categorysearchbox.module.css';

export default function ChooseCategory() {
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const [searchText, setSearchText] = useState('');

  // This hook returns true on screens up to 1000px wide
  const isMobile = useMediaQuery("(max-width: 1000px)");

  // Hide component on larger screens
  if (!isMobile) return null;

  const typewriterStrings = [
    'Window Pillar Wraps',
    'Car Fresheners',
    'Bonnet Wraps',
    'Keychains',
    'Tank Wraps',
  ];

  const handleFocus = () => {
    dispatch(openSearchDialog());
  };

  const handleChange = (e) => {
    setSearchText(e.target.value);
  };

  return (
    <div className={searchStyles.unexpandedWhite} >
      <div className={searchStyles.searchBoxContainer} >
        <div className={searchStyles.searchBoxSubContainer} onClick={handleFocus}>
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
            className={searchStyles.inputContainer}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {searchText === '' && (
              <Typewriter
                options={{
                  strings: typewriterStrings,
                  autoStart: true,
                  loop: true,
                  delay: 40,
                  deleteSpeed: 10,
                }}
              />
            )}

            <div
              type="text"
              spellCheck="false"
              value={searchText}
              className={`${searchStyles.inputField} ${searchStyles.nonDialogInputField}`}
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
  );
}
