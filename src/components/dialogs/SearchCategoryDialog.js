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
  // Restore suggestions, categories, variants state
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [matchedCategory, setMatchedCategory] = useState(null);
  const inputRef = useRef(null);
  const suggestionBoxRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
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
    // Commented out: suggestions state
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
      // attach scroll listener to suggestion box when opened
      const el = suggestionBoxRef.current;
      const onScroll = () => {
        if (!el) return;
        setScrolled(el.scrollTop > 6);
      };
      if (el) el.addEventListener('scroll', onScroll);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (el) el.removeEventListener('scroll', onScroll);
        clearTimeout(focusTimeout);
      };
    }

    return () => clearTimeout(focusTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Generic scroll listener for suggestionBox (desktop & mobile)
  useEffect(() => {
    const el = suggestionBoxRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 6);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Also try to focus using another useEffect (as a backup)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Restore suggestions logic
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

  // Restore suggestion click logic
  const handleSuggestionClick = useCallback((suggestion) => {
    const categoryObj = categories.find(
      (c) => c.name.toLowerCase() === suggestion.toLowerCase()
    );
    if (categoryObj && categoryObj.pageSlug) {
      router.push(`/shop/${categoryObj.pageSlug}`);
    }
    handleClose(true);
  }, [categories, router, handleClose]);

  // Restore Enter key suggestion logic
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

  // Product search fetch effect
  useEffect(() => {
    if (!searchText.trim()) {
      setProductResults([]);
      setProductLoading(false);
      setMatchedCategory(null);
      return;
    }
    setProductLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchText.trim())}`, {
        signal: controller.signal
      })
        .then(res => res.json())
        .then(data => {
          setProductResults(Array.isArray(data.products) ? data.products : []);
          setMatchedCategory(data.category || null);
          setProductLoading(false);
        })
        .catch(() => {
          setProductResults([]);
          setMatchedCategory(null);
          setProductLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
      setProductLoading(false);
      setMatchedCategory(null);
    };
  }, [searchText]);

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
          position: 'sticky',
          top: 0,
          zIndex: 1200,
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
              variant="h7"
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
          height: '100vh',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#fafafa',
          overflow: 'hidden'
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
              <textarea
                ref={inputRef}
                rows={1}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={handleInputChange}
                className={`${searchStyles.inputField} ${searchStyles.dialogInputField}`}
                value={searchText}
                placeholder=""
                style={{
                  flex: 1,
                  fontSize: '1.2rem',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  position: 'relative',
                  zIndex: 2,
                  resize: 'none',
                  overflow: 'hidden',
                  lineHeight: '1.2'
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
            px: { xs: 0.5, sm: 1 },
            position: 'relative'
          }} 
          className={`${searchStyles.suggestionBox} ${scrolled ? searchStyles.scrolledTop : ''}`}
          ref={suggestionBoxRef}
        >
          {searchCategoriesCache?.isLoading ? (
            <Fade in={searchCategoriesCache?.isLoading} timeout={500}>
              <div>
                <SkeletonLoader />
              </div>
            </Fade>
          ) : (
            <>
              {/* Product search results UI */}
              {searchText.trim() && productResults.length > 0 && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08
                      }
                    }
                  }}
                >
                  {/* <Typography variant="subtitle2" sx={{ color: '#888', fontFamily: 'Jost', fontWeight: 500, mb: 1, ml: 1 }}>
                    Products
                  </Typography> */}
                  <List>
                    {productResults.map((product, i) => (
                      <motion.div
                        key={product._id}
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
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 90,
                            transition: 'box-shadow 0.2s',
                            '&:hover': {
                              boxShadow: '0 4px 16px rgba(0,0,0,0.10)'
                            }
                          }}
                          onClick={() => handleProductClick(product)}
                        >
                          <Box sx={{ width: 64, height: 64, borderRadius: 2, overflow: 'hidden', mr: 2, background: '#f7f7f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                              src={product.images && product.images[0] ? `${baseUrl}${product.images[0].startsWith('/') ? '' : '/'}${product.images[0]}` : '/images/assets/gifs/helmetloadinggiflandscape2.gif'}
                              alt={product.name}
                              width={64}
                              height={64}
                              style={{ objectFit: 'cover', borderRadius: 8 }}
                            />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body1"
                              sx={{ fontFamily: 'Jost', fontWeight: 600, color: '#222', fontSize: '1.08rem', lineHeight: 1.2, mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {product.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'Jost', color: '#666', fontWeight: 400, fontSize: '0.98rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {product.title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <Typography sx={{ fontWeight: 700, color: '#1a8917', fontFamily: 'Jost', fontSize: '1.05rem', mr: 1 }}>
                                ₹{product.price}
                              </Typography>
                              <Typography sx={{ color: '#888', textDecoration: 'line-through', fontSize: '0.98rem', fontFamily: 'Jost', fontWeight: 400 }}>
                                ₹{product.MRP}
                              </Typography>
                            </Box>
                          </Box>
                        </ListItem>
                      </motion.div>
                    ))}
                  </List>

                  {/* Matched category - show 'See all (Category)' below products */}
                  {matchedCategory && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                      <ListItem
                        className={searchStyles.suggestionItem}
                        sx={{
                          cursor: 'pointer',
                          backgroundColor: 'white',
                          mb: 1,
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: 64
                        }}
                        onClick={() => {
                          router.push(`/shop/${matchedCategory.pageSlug}`);
                          handleClose(true);
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Image src={`${baseUrl}/assets/icons/thin-search.png`} width={20} height={20} alt="search" />
                        </ListItemIcon>
                        <ListItemText primary={<Typography sx={{ fontWeight: 600, fontFamily: 'Jost', color: '#222' }}>{`See all ${matchedCategory.name}`}</Typography>} />
                      </ListItem>
                    </motion.div>
                  )}
                </motion.div>
              )}
              {/* Suggestions UI (show only when input is empty) */}
              {searchText.trim() === '' && suggestions.length > 0 && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
                  }}
                  style={{ marginBottom: productResults.length > 0 ? 24 : 0 }}
                >
                  <List>
                    {suggestions.map((text, i) => (
                      <motion.div
                        key={i}
                        variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
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
                                  sx={{ fontFamily: 'Jost', fontWeight: 500 }}
                                >
                                  {text}
                                </Typography>
                                {isNewItem(text) && <span className={searchStyles.newLabel}>New</span>}
                              </Box>
                            }
                          />
                        </ListItem>
                      </motion.div>
                    ))}
                  </List>
                </motion.div>
              )}
              {/* If nothing found or loading */}
              {searchText.trim() && (productLoading || (suggestions.length === 0 && productResults.length === 0)) && (
                <>
                  {productLoading ? (
                    <SkeletonLoader />
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
                          No result found
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
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
