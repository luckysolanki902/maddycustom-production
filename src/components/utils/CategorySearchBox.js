'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Typewriter from 'typewriter-effect';
import { useDispatch } from 'react-redux';
import { openSearchDialog } from '@/store/slices/uiSlice';
import searchStyles from './styles/categorysearchbox.module.css';

export default function ChooseCategory() {
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const [searchText, setSearchText] = useState('');

  // Hard-code or omit if you want no placeholders:
  const typewriterStrings = [
    'Window Pillar Wraps',
    'Car Fresheners',
    'Bonnet Wraps',
    'Keychains',
    'Tank Wraps',
  ];

  // On focus => open the dialog
  const handleFocus = () => {
    dispatch(openSearchDialog());
  };

  // Just in case user types in it 
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
            {/**
             * Show typewriter if user hasn't typed anything,
             * i.e. searchText is empty
             */}
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

            {/**
             * Make it an <input> so it can truly focus/click,
             * but we keep it visually “transparent”.
             */}
            <div
              type="text"
              spellCheck="false"
            //   onClick={handleFocus}
            //   onChange={handleChange}
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
