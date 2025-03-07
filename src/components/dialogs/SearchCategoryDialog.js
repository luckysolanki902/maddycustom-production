'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Slide,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { closeSearchDialog } from '@/store/slices/uiSlice';
import searchStyles from './styles/categorysearchbox.module.css';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="down" ref={ref} {...props} />;
});

async function fetchSearchCategories() {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
    const res = await fetch(`${BASE_URL}/api/search/search-categories`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`Failed to fetch search categories. Status: ${res.status}`);
      throw new Error('Failed to fetch search categories');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching search categories:', error.message);
    throw error;
  }
}

export default function SearchCategoryDialog() {
  const dispatch = useDispatch();
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isOpen = useSelector((state) => state.ui.isSearchDialogOpen);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);
  const inputRef = useRef(null);
  // Track whether we've pushed a history state (for mobile only)
  const pushedStateRef = useRef(false);

  // Determine if we're on mobile (using a width threshold)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1000;

  // Close the dialog
  const handleClose = () => {
    if (isMobile && pushedStateRef.current) {
      window.history.back();
      pushedStateRef.current = false;
    } else {
      dispatch(closeSearchDialog());
    }
    setSearchText('');
    setSuggestions([]);
  };

  // When dialog opens, fetch categories/variants and (if mobile) push history state
  useEffect(() => {
    if (isOpen) {
      if (isMobile && !pushedStateRef.current) {
        window.history.pushState({ searchDialog: true }, '');
        pushedStateRef.current = true;
      }
      setIsLoading(true);
      fetchSearchCategories()
        .then((data) => {
          if (data?.categories && data?.variants) {
            setCategories(data.categories);
            setVariants(data.variants);
            const catNames = data.categories.map((c) => c.name);
            const varNames = data.variants.map((v) => v.name);
            setSuggestions([...catNames, ...varNames].slice(0, 10));
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setIsLoading(false);
        });

      // Delay focus until the Dialog is fully rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

      if (isMobile) {
        const handlePopState = () => {
          dispatch(closeSearchDialog());
          pushedStateRef.current = false;
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
      }
    }
  }, [isOpen, dispatch, isMobile]);

  // Also try to focus using another useEffect (as a backup)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Filter suggestions when input changes
  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchText(inputValue);

    if (!categories.length || !variants.length) return;

    if (inputValue.trim() !== '') {
      const lower = inputValue.toLowerCase();
      const catFiltered = categories
        .filter((cat) => cat.name.toLowerCase().includes(lower))
        .map((c) => c.name);
      const varFiltered = variants
        .filter((v) => v.name.toLowerCase().includes(lower))
        .map((v) => v.name);
      setSuggestions([...catFiltered, ...varFiltered].slice(0, 10));
    } else {
      const catNames = categories.map((c) => c.name);
      const varNames = variants.map((v) => v.name);
      setSuggestions([...catNames, ...varNames].slice(0, 10));
    }
  };

  // Clicking a suggestion navigates accordingly and then closes the dialog
  const handleSuggestionClick = (suggestion) => {
    const variantObj = variants.find(
      (v) => v.name.toLowerCase() === suggestion.toLowerCase()
    );
    if (variantObj && variantObj.pageSlug) {
      router.push(`/shop/${variantObj.pageSlug}`);
    } else {
      const categoryObj = categories.find(
        (c) => c.name.toLowerCase() === suggestion.toLowerCase()
      );
      if (categoryObj) {
        const firstVariant = variants.find(
          (v) => String(v.specificCategory) === String(categoryObj.id)
        );
        if (firstVariant?.pageSlug) {
          router.push(`/shop/${firstVariant.pageSlug}`);
        }
      }
    }
    handleClose();
  };

  // Pressing Enter picks the first suggestion
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && suggestions.length) {
        handleSuggestionClick(suggestions[0]);
      }
    },
    [suggestions]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <Dialog
      fullScreen
      open={isOpen}
      onClose={handleClose} // Closes on tapping outside or pressing ESC
      TransitionComponent={Transition}
      PaperProps={{ style: { backgroundColor: 'white' } }}
    >
      <AppBar
        sx={{ position: 'relative', backgroundColor: 'white', boxShadow: 'none' }}
      >
        <Toolbar className={searchStyles.searchheader}>
          <IconButton edge="start" color="inherit" onClick={handleClose}>
            <Image
              src={`${baseUrl}/assets/icons/left-arrow.png`}
              width={24}
              height={24}
              alt="Back"
              style={{ cursor: 'pointer' }}
            />
          </IconButton>
          <Typography
            sx={{ ml: 2, flex: 1, color: 'black', fontFamily: 'Jost' }}
            variant="h6"
            component="div"
          >
            Customize your vehicle, your way!
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          p: 2,
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search Input */}
        <Box
          className={searchStyles.searchBoxSubContainer}
          sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
        >
          <Image
            src={`${baseUrl}/assets/icons/search.png`}
            width={24}
            height={24}
            alt="search"
            style={{ marginRight: 16 }}
          />
          <input
            ref={inputRef}
            type="text"
            spellCheck={false}
            onChange={handleInputChange}
            className={`${searchStyles.inputField} ${searchStyles.dialogInputField}`}
            value={searchText}
            placeholder="Search..."
            style={{
              flex: 1,
              fontSize: '1.2rem',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
        </Box>

        {/* Suggestions List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }} className={searchStyles.suggestionBox}>
          {suggestions.length ? (
            <List>
              {suggestions.map((text, i) => (
                <ListItem
                  key={i}
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
                  onClick={() => handleSuggestionClick(text)}
                >
                  <ListItemIcon>
                    <Image
                      src={`${baseUrl}/assets/icons/thin-search.png`}
                      width={25}
                      height={25}
                      alt="thin search"
                      priority
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" component="span" sx={{ fontFamily: 'Jost' }}>
                          {text}
                        </Typography>
                        {['helmet', 'tank', 'pillar', 'bonnet'].some((w) =>
                          text.toLowerCase().includes(w)
                        ) && (
                          <Image
                            src={`${baseUrl}/assets/icons/new.png`}
                            width={30}
                            height={30}
                            alt="New"
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="h6" align="center" sx={{ mt: 4, fontFamily: 'Jost' }}>
              {isLoading ? 'Loading Categories...' : 'No results found'}
            </Typography>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
