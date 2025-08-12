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
  Fade,
} from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { closeSearchDialog } from '@/store/slices/uiSlice';
import { 
  setSearchCategoriesLoading, 
  setSearchCategories 
} from '@/store/slices/persistentUiSlice';
import searchStyles from './styles/categorysearchbox.module.css';
import { typewriterStrings } from '@/lib/constants/typewriterCategories';
import Typewriter from 'typewriter-effect';
import { motion } from 'framer-motion';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="down" ref={ref} {...props} />;
});

// Global flag to prevent multiple simultaneous requests
let globalFetchInProgress = false;
let globalDataCache = null;
let globalCacheTimestamp = null;

async function fetchSearchCategories() {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
    const res = await fetch(`/api/search/search-categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`Failed to fetch search categories. Status: ${res.status}`);
      // throw new Error('Failed to fetch search categories');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching search categories:', error.message);
    throw error;
  }
}

// Skeleton component for loading state
const SkeletonLoader = () => {
  return Array(5).fill(0).map((_, index) => (
    <div key={index} className={searchStyles.skeletonItem}></div>
  ));
};

export default function SearchCategoryDialog() {
  const dispatch = useDispatch();
  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isOpen = useSelector((state) => state.ui.isSearchDialogOpen);
  const searchCategoriesCache = useSelector((state) => state.persistentUi?.searchCategories || {
    data: null,
    lastFetched: null,
    isLoading: false
  });
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);
  const inputRef = useRef(null);
  // Track whether we've pushed a history state (for mobile only)
  const pushedStateRef = useRef(false);
  // Track if we've already initiated a fetch to prevent duplicate requests
  const fetchInitiatedRef = useRef(false);
  // Track if we've already loaded data for this session
  const dataLoadedRef = useRef(false);

  // Cache expiry time (1 hour = 3600000 ms)
  const CACHE_EXPIRY_TIME = 3600000;

  // Determine if we're on mobile (using a width threshold)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1000;

  // Close the dialog with an option to skip history manipulation
  const handleClose = useCallback((skipHistory = false) => {
    if (isMobile && pushedStateRef.current) {
      if (skipHistory) {
        // Instead of going back, replace the current history entry to clean up
        window.history.replaceState(null, document.title);
      } else {
        window.history.back();
      }
      pushedStateRef.current = false;
    }
    dispatch(closeSearchDialog());
    setSearchText('');
    setSuggestions([]);
  }, [dispatch, isMobile]);

  // When dialog opens, fetch categories/variants and (if mobile) push history state
  useEffect(() => {
    if (!isOpen) {
      // Reset flags when dialog closes
      fetchInitiatedRef.current = false;
      dataLoadedRef.current = false;
      return;
    }

    // Prevent multiple executions for the same dialog session
    if (dataLoadedRef.current) {
      console.log('Data already loaded for this session, skipping...');
      return;
    }

    console.log('Dialog opened, checking data...');

    // Handle mobile history state
    if (isMobile && !pushedStateRef.current) {
      window.history.pushState({ searchDialog: true }, '');
      pushedStateRef.current = true;
    }

    // Check for valid cache first (independent of Redux)
    const now = Date.now();
    const hasValidGlobalCache = globalDataCache && globalCacheTimestamp && 
                               (now - globalCacheTimestamp) < CACHE_EXPIRY_TIME;

    if (hasValidGlobalCache) {
      console.log('Using global cache...');
      setCategories(globalDataCache.categories || []);
      setVariants(globalDataCache.variants || []);
      const catNames = (globalDataCache.categories || []).map((c) => c.name);
      setSuggestions(catNames.slice(0, 10));
      dataLoadedRef.current = true;
      return;
    }

    // Check Redux cache as fallback
    const hasValidReduxCache = searchCategoriesCache?.data && 
                              searchCategoriesCache?.lastFetched && 
                              (now - searchCategoriesCache.lastFetched) < CACHE_EXPIRY_TIME;

    if (hasValidReduxCache) {
      console.log('Using Redux cache...');
      const cachedData = searchCategoriesCache.data;
      setCategories(cachedData.categories || []);
      setVariants(cachedData.variants || []);
      const catNames = (cachedData.categories || []).map((c) => c.name);
      setSuggestions(catNames.slice(0, 10));
      dataLoadedRef.current = true;
      
      // Update global cache
      globalDataCache = cachedData;
      globalCacheTimestamp = searchCategoriesCache.lastFetched;
      return;
    }

    // Need to fetch new data
    if (globalFetchInProgress || fetchInitiatedRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    console.log('Fetching new data...');
    fetchInitiatedRef.current = true;
    globalFetchInProgress = true;
    dispatch(setSearchCategoriesLoading(true));

    const fetchData = async () => {
      try {
        const data = await fetchSearchCategories();
        if (data?.categories) {
          const categoriesData = data.categories;
          const variantsData = data.variants || [];
          
          // Update global cache
          globalDataCache = { categories: categoriesData, variants: variantsData };
          globalCacheTimestamp = Date.now();
          
          // Update Redux cache
          dispatch(setSearchCategories({
            categories: categoriesData,
            variants: variantsData
          }));
          
          // Update local state
          setCategories(categoriesData);
          setVariants(variantsData);
          const catNames = categoriesData.map((c) => c.name);
          setSuggestions(catNames.slice(0, 10));
          dataLoadedRef.current = true;
          
          console.log('Data fetched successfully');
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        dispatch(setSearchCategoriesLoading(false));
        fetchInitiatedRef.current = false;
        globalFetchInProgress = false;
      }
    };

    fetchData();

    // Focus input after dialog opens
    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    // Handle mobile back button
    if (isMobile) {
      const handlePopState = () => {
        handleClose();
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        clearTimeout(focusTimeout);
      };
    }

    return () => clearTimeout(focusTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

    if (!categories.length) return;

    if (inputValue.trim() !== '') {
      const lower = inputValue.toLowerCase();
      const catFiltered = categories
        .filter((cat) => cat.name.toLowerCase().includes(lower))
        .map((c) => c.name);
      setSuggestions(catFiltered.slice(0, 10));
    } else {
      const catNames = categories.map((c) => c.name);
      setSuggestions(catNames.slice(0, 10));
    }
  };

  // Clicking a suggestion navigates accordingly and then closes the dialog
  const handleSuggestionClick = useCallback((suggestion) => {
    const categoryObj = categories.find(
      (c) => c.name.toLowerCase() === suggestion.toLowerCase()
    );
    
    if (categoryObj && categoryObj.pageSlug) {
      router.push(`/shop/${categoryObj.pageSlug}`);
    }
    
    // For route navigation on mobile, skip the history back step
    handleClose(true);
  }, [categories, router, handleClose]);

  // Pressing Enter picks the first suggestion
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && suggestions.length) {
        handleSuggestionClick(suggestions[0]);
      }
    },
    [suggestions, handleSuggestionClick]
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

  const isNewItem = (text) => {
    return [ 'freshener', 'bonnet'].some((w) =>
      text.toLowerCase().includes(w)
    );
  };

  return (
    <Dialog
      fullScreen
      open={isOpen}
      onClose={() => handleClose()}
      TransitionComponent={Transition}
      sx={{ zIndex: 9999 }}
      PaperProps={{ style: { backgroundColor: 'white' } }}
    >
      <AppBar
        sx={{ 
          position: 'relative', 
          backgroundColor: 'white', 
          boxShadow: 'none',
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <Toolbar className={searchStyles.searchheader}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <IconButton edge="start" color="inherit" onClick={() => handleClose()}>
              <Image
                src={`${baseUrl}/assets/icons/left-arrow.png`}
                width={24}
                height={24}
                alt="Back"
                style={{ cursor: 'pointer' }}
                loading='eager'
                priority
              />
            </IconButton>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{ flex: 1 }}
          >
            <Typography
              sx={{ 
                ml: 2, 
                flex: 1, 
                color: '#333',
                fontWeight: 500,
                fontFamily: 'Jost' 
              }}
              variant="h6"
              component="div"
            >
              Customize your vehicle, your way!
            </Typography>
          </motion.div>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#fafafa'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Box
            className={searchStyles.searchBoxSubContainer}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              mt: { xs: 1, sm: 2 }
            }}
          >
            <Image
              src={`${baseUrl}/assets/icons/search.png`}
              width={24}
              height={24}
              alt="search"
              className={searchStyles.searchIcon}
            />
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              {searchText === '' && (
                <div className={searchStyles.typewriterContainer}>
                  <Typewriter
                    options={{
                      strings: typewriterStrings,
                      autoStart: true,
                      loop: true,
                      delay: 40,
                      deleteSpeed: 10,
                      wrapperClassName: 'typewriter-text'
                    }}
                  />
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                spellCheck={false}
                onChange={handleInputChange}
                className={`${searchStyles.inputField} ${searchStyles.dialogInputField}`}
                value={searchText}
                autoFocus
                placeholder=""
                style={{
                  flex: 1,
                  fontSize: '1.2rem',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  position: 'relative',
                  zIndex: 2
                }}
              />
            </div>
          </Box>
        </motion.div>

        <Box 
          sx={{ 
            flex: 1, 
            overflowY: 'auto',
            mt: 1,
            px: { xs: 0.5, sm: 1 }
          }} 
          className={searchStyles.suggestionBox}
        >
          {searchCategoriesCache?.isLoading ? (
            <Fade in={searchCategoriesCache?.isLoading} timeout={500}>
              <div>
                <SkeletonLoader />
              </div>
            </Fade>
          ) : suggestions.length ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05
                  }
                }
              }}
            >
              <List>
                {suggestions.map((text, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      visible: { opacity: 1, x: 0 }
                    }}
                  >
                    <ListItem
                      className={searchStyles.suggestionItem}
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: 'white',
                        mb: 1,
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                      onClick={() => handleSuggestionClick(text)}
                    >
                      <ListItemIcon sx={{ minWidth: '40px' }}>
                        <Image
                          src={`${baseUrl}/assets/icons/thin-search.png`}
                          width={20}
                          height={20}
                          alt="search"
                          priority
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <Typography 
                              variant="body1" 
                              component="span" 
                              sx={{ 
                                fontFamily: 'Jost',
                                fontWeight: 500
                              }}
                            >
                              {text}
                            </Typography>
                            {isNewItem(text) && (
                              <span className={searchStyles.newLabel}>New</span>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Box 
                sx={{ 
                  mt: 8, 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2 
                }}
              >
                <Image
                  src={`${baseUrl}/assets/icons/search.png`}
                  width={60}
                  height={60}
                  alt="search"
                  style={{ opacity: 0.5, marginBottom: '1rem' }}
                />
                <Typography 
                  variant="body1" 
                  align="center" 
                  sx={{ 
                    fontFamily: 'Jost',
                    color: '#666',
                    fontWeight: 500 
                  }}
                >
                  No matching categories found
                </Typography>
                <Typography
                  variant="body2"
                  align="center"
                  sx={{
                    fontFamily: 'Jost',
                    color: '#888',
                    mt: 1
                  }}
                >
                  Try a different search term
                </Typography>
              </Box>
            </motion.div>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
