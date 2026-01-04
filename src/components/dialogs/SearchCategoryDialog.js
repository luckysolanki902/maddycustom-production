'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchEvent } from '@/lib/metadata/facebookPixels';
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
import VariantSelectionDialog from './VariantSelectionDialog';
import { 
  setSearchCategoriesLoading, 
  setSearchCategories 
} from '@/store/slices/persistentUiSlice';
import { startNavigation } from '@/store/slices/navigationSlice';
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
  // Variant selection state
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [selectedCategoryForVariants, setSelectedCategoryForVariants] = useState(null);
  const [variantCheckingProduct, setVariantCheckingProduct] = useState(null);
  
  // Rotating search suggestions state
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  
  // Search suggestions array
  const searchSuggestions = [
    "Anime",
    "Formal", 
    "Wraps",
    "Quote",
    "Religious"
  ];


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

  // Track recent searches to prevent duplicates
  const recentTracksRef = useRef(new Set());
  const trackTimeoutRef = useRef(null);

  // Function to track search queries asynchronously with deduplication
  const trackSearch = useCallback((query, resultType, clickedPageSlug = null) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Create unique key for this tracking event
    const trackingKey = `${trimmedQuery}:${resultType}:${clickedPageSlug || 'none'}`;
    
    // Check if we've already tracked this exact event recently (within 5 seconds)
    if (recentTracksRef.current.has(trackingKey) || clickedPageSlug === null) {
      return;
    }

    // Add to recent tracks to prevent duplicates
    recentTracksRef.current.add(trackingKey);
    
    // Clear the tracking key after 5 seconds
    setTimeout(() => {
      recentTracksRef.current.delete(trackingKey);
    }, 5000);

    // Clear any pending timeout
    if (trackTimeoutRef.current) {
      clearTimeout(trackTimeoutRef.current);
    }

    // Debounce the actual API call slightly to prevent rapid-fire requests
    trackTimeoutRef.current = setTimeout(() => {
      // Don't block UI - fire and forget
      fetch('/api/analytics/search-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          resultType,
          clickedPageSlug,
          sessionId: typeof window !== 'undefined' ? 
            sessionStorage.getItem('searchSessionId') || 
            (() => {
              const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
              sessionStorage.setItem('searchSessionId', id);
              return id;
            })() : null,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Silent fail
    }, 100); // 100ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (trackTimeoutRef.current) {
        clearTimeout(trackTimeoutRef.current);
      }
    };
  }, []);

  // Rotate search suggestions with fade effect
  useEffect(() => {
    if (searchText.trim() !== '') return; // Only rotate when search is empty
    
    const rotationInterval = setInterval(() => {
      setSuggestionVisible(false);
      
      setTimeout(() => {
        setCurrentSuggestionIndex((prevIndex) => 
          (prevIndex + 1) % searchSuggestions.length
        );
        setSuggestionVisible(true);
      }, 300); // Half of fade duration
      
    }, 3000); // Change suggestion every 3 seconds
    
    return () => clearInterval(rotationInterval);
  }, [searchText, searchSuggestions.length]);

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

  // Handle variant selection from the variant dialog
  const handleVariantSelect = useCallback((variant, targetUrl) => {
    dispatch(startNavigation());
    router.push(targetUrl);
    setShowVariantDialog(false);
    handleClose(true);
  }, [router, dispatch, handleClose]);



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

    // Focus input after dialog opens with improved timing
    const focusTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Move cursor to end if there's any text
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      });
    }, 150);

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

  // Enhanced scroll listener for suggestionBox with smooth transitions
  useEffect(() => {
    const el = suggestionBoxRef.current;
    if (!el) return;
    
    let scrollTimeout;
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      const isScrolled = el.scrollTop > 10;
      setScrolled(isScrolled);
      
      // Add smooth scroll behavior
      scrollTimeout = setTimeout(() => {
        if (el.scrollTop > 10) {
          setScrolled(true);
        }
      }, 50);
    };
    
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isOpen]);

  // Also try to focus using another useEffect (as a backup)
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Multiple attempts to ensure focus works on all devices
      const attempts = [50, 200, 400];
      const timeouts = attempts.map(delay => 
        setTimeout(() => {
          if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.focus();
          }
        }, delay)
      );
      return () => timeouts.forEach(clearTimeout);
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
      // Track the click before navigation
  trackSearch(searchText || suggestion, 'category', `/shop/${categoryObj.pageSlug}`);
  try { void searchEvent({ search_string: (searchText || suggestion), content_category: 'category' }); } catch {}
      // Start full page loading
      dispatch(startNavigation());
      router.push(`/shop/${categoryObj.pageSlug}`);
    }
    handleClose(true);
  }, [categories, router, handleClose, trackSearch, searchText, dispatch]);

  // Handle rotating suggestion click - replace input text and trigger search
  const handleRotatingSuggestionClick = useCallback((suggestionText) => {
    setSearchText(suggestionText);
    // Focus the input after setting the text
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Trigger search immediately
    const lower = suggestionText.toLowerCase();
    const catFiltered = categories
      .filter((cat) => cat.name.toLowerCase().includes(lower))
      .map((c) => c.name);
    setSuggestions(catFiltered.slice(0, 10));
  }, [categories]);

  // Handle product click with variant checking
  const handleProductClick = useCallback(async (product) => {
    const pageSlug = `/shop/${product.pageSlug}`;
  trackSearch(searchText, 'product', pageSlug);
  try { void searchEvent({ search_string: searchText, content_category: 'product' }); } catch {}

    // Check if product has specific category for variant checking
    if (!product.specificCategory) {
      // No specific category, navigate directly
      dispatch(startNavigation());
      router.push(pageSlug);
      handleClose(true);
      return;
    }

    // Set loading state for this product
    setVariantCheckingProduct(product._id);

    try {
      // Check variant count for this product's category
      const response = await fetch(`/api/features/get-variants?categoryId=${product.specificCategory}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      const variants = data.variants || [];
      

      
      if (variants.length <= 1) {
        // Single or no variants - navigate directly
        dispatch(startNavigation());
        router.push(pageSlug);
        handleClose(true);
      } else {
        // Multiple variants - show variant selection dialog
        console.log('Showing variant dialog for:', product.name);
        setSelectedProductForVariants(product);
        setSelectedCategoryForVariants({ 
          _id: product.specificCategory,
          id: product.specificCategory, 
          name: product.name || 'Product Variants'
        });
        setShowVariantDialog(true);
      }
    } catch (error) {
      console.error('Error checking variants:', error);
      console.error('Product:', product.name, 'CategoryId:', product.specificCategory);
      
      // Fallback to direct navigation
      dispatch(startNavigation());
      router.push(pageSlug);
      handleClose(true);
    } finally {
      setVariantCheckingProduct(null);
    }
  }, [router, handleClose, trackSearch, searchText, dispatch]);

  // Restore Enter key suggestion logic
  const handleKeyDown = useCallback(
    (e) => {
      //prevent default enter behavior
      if (e.key === 'Enter' && suggestions.length) {
        e.preventDefault();
        
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
      const trimmedQuery = searchText.trim();
      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal
      })
        .then(res => res.json())
        .then(data => {
          const products = Array.isArray(data.products) ? data.products : [];
          let category = data.category || null;
          
          // Client-side category matching as backup/improvement
          if (!category && categories.length > 0) {
            const normalizedQuery = trimmedQuery.toLowerCase();
            const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
            
            // Find best matching category
            let bestMatch = null;
            let bestScore = 0;
            
            for (const cat of categories) {
              const catName = cat.name.toLowerCase();
              let score = 0;
              
              // Exact match gets highest score
              if (catName === normalizedQuery) {
                score = 100;
              }
              // Contains full query
              else if (catName.includes(normalizedQuery)) {
                score = 80;
              }
              // All query words present
              else if (queryWords.length > 1 && queryWords.every(word => catName.includes(word))) {
                score = 60;
              }
              // Some words match (only for single word queries or as last resort)
              else if (queryWords.length === 1 && catName.includes(queryWords[0])) {
                score = 40;
              }
              
              if (score > bestScore) {
                bestScore = score;
                bestMatch = cat;
              }
            }
            
            // Only use client-side match if it's a good match (score > 50)
            if (bestMatch && bestScore > 50) {
              category = {
                id: bestMatch._id,
                name: bestMatch.name,
                pageSlug: bestMatch.pageSlug
              };
            }
          }
          
          setProductResults(products);
          setMatchedCategory(category);
          setProductLoading(false);
          
          // Track search result in background
          const resultType = products.length > 0 ? 'product' : 
                            category ? 'category' : 'no_results';
          trackSearch(trimmedQuery, resultType);
          try { void searchEvent({ search_string: trimmedQuery, content_category: resultType }); } catch {}
        })
        .catch(() => {
          setProductResults([]);
          setMatchedCategory(null);
          setProductLoading(false);
          // Track failed search
          trackSearch(trimmedQuery, 'no_results');
          try { void searchEvent({ search_string: trimmedQuery, content_category: 'no_results' }); } catch {}
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
      setProductLoading(false);
      setMatchedCategory(null);
    };
  }, [searchText, trackSearch, categories]);

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
                autoFocus
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
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
            {/* Ask AI Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
              }}
              transition={{ duration: 0.4, delay: 0.3 }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4), 0 0 20px rgba(139, 92, 246, 0.3)'
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const query = searchText.trim();
                handleClose(true);
                // Dispatch custom event to open chat dialog with optional query
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('mc-open-chat-dialog', { detail: { query } }));
                }, 100);
              }}
              style={{
                marginLeft: 10,
                padding: '10px 18px',
                background: '#2d2d2d',
                backgroundSize: '200% 100%',
                color: '#fff',
                border: 'none',
                borderRadius: 24,
                fontSize: '0.9rem',
                fontWeight: 700,
                fontFamily: 'Jost, sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 20px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(255,255,255,0.2) inset',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <motion.span 
                animate={{ 
                  rotate: [0, 10, -10, 10, 0],
                  scale: [1, 1.1, 1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
                style={{ fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✨
              </motion.span>
              <span style={{ position: 'relative', zIndex: 1 }}>Ask AI</span>
              <motion.div
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                  ease: 'easeInOut'
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '30%',
                  height: '100%',
                  background: '#2d2d2d',
                  transform: 'skewX(-20deg)',
                }}
              />
            </motion.button>

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
                  {/* Matched category - show 'See all (Category)' at the top */}
                  {matchedCategory && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
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
                          trackSearch(searchText, 'category', `/shop/${matchedCategory.pageSlug}`);
                          try { void searchEvent({ search_string: searchText, content_category: 'category' }); } catch {}
                          // Start full page loading
                          dispatch(startNavigation());
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
                            cursor: variantCheckingProduct === product._id ? 'wait' : 'pointer',
                            backgroundColor: 'white',
                            mb: 1.2,
                            borderRadius: '14px',
                            boxShadow: '0 3px 12px rgba(0,0,0,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 80,
                            p: 2,
                            transition: 'all 0.25s ease',
                            border: '1px solid rgba(0,0,0,0.03)',
                            opacity: variantCheckingProduct === product._id ? 0.6 : 1,
                            pointerEvents: variantCheckingProduct === product._id ? 'none' : 'auto',
                            '&:hover': {
                              transform: variantCheckingProduct === product._id ? 'none' : 'translateY(-1px)',
                              boxShadow: variantCheckingProduct === product._id ? '0 3px 12px rgba(0,0,0,0.06)' : '0 6px 20px rgba(0,0,0,0.1)',
                              borderColor: 'rgba(0,0,0,0.06)'
                            }
                          }}
                          onClick={() => handleProductClick(product)}
                        >
                          <Box sx={{ 
                            width: 68, 
                            height: 68, 
                            borderRadius: 2.5, 
                            overflow: 'hidden', 
                            mr: 2, 
                            background: '#f8f9fa', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                            border: '1px solid rgba(0,0,0,0.04)'
                          }}>
                            <Image
                              src={product.images && product.images[0] ? `${baseUrl}${product.images[0].startsWith('/') ? '' : '/'}${product.images[0]}` : '/images/assets/gifs/helmetloadinggiflandscape2.gif'}
                              alt={product.title}
                              width={68}
                              height={68}
                              style={{ objectFit: 'cover', borderRadius: 10 }}
                            />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body1"
                              sx={{ 
                                fontFamily: 'Jost', 
                                fontWeight: 500, 
                                color: '#2d2d2d', 
                                fontSize: '1rem', 
                                lineHeight: 1.4, 
                                mb: 1, 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis' 
                              }}
                            >
                              {product.title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {variantCheckingProduct === product._id ? (
                                <Typography sx={{ 
                                  color: '#666', 
                                  fontSize: '0.9rem', 
                                  fontFamily: 'Jost', 
                                  fontWeight: 500,
                                  fontStyle: 'italic'
                                }}>
                                  Checking variants...
                                </Typography>
                              ) : (
                                <>
                                  <Typography sx={{ 
                                    fontWeight: 600, 
                                    color: '#2d2d2d', 
                                    fontFamily: 'Jost', 
                                    fontSize: '1.05rem'
                                  }}>
                                    ₹{product.price}
                                  </Typography>
                                  <Typography sx={{ 
                                    color: '#888', 
                                    textDecoration: 'line-through', 
                                    fontSize: '0.92rem', 
                                    fontFamily: 'Jost', 
                                    fontWeight: 400 
                                  }}>
                                    ₹{product.MRP}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </Box>
                        </ListItem>
                      </motion.div>
                    ))}
                  </List>
                </motion.div>
              )}
              
              {/* Rotating Search Suggestions (show only when input is empty) */}
              {searchText.trim() === '' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ marginBottom: 16 }}
                >
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
                    onClick={() => handleRotatingSuggestionClick(searchSuggestions[currentSuggestionIndex])}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Image 
                        src={`${baseUrl}/assets/icons/thin-search.png`} 
                        width={20} 
                        height={20} 
                        alt="search" 
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Typography sx={{ fontWeight: 600, fontFamily: 'Jost', color: '#222' }}>
                          Try searching for{' '}
                          <Fade in={suggestionVisible} timeout={600}>
                            <span style={{ color: '#007bff' }}>
                              &ldquo;{searchSuggestions[currentSuggestionIndex]}&rdquo;
                            </span>
                          </Fade>
                        </Typography>
                      } 
                    />
                  </ListItem>
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

      {/* Variant Selection Dialog */}
      <VariantSelectionDialog
        open={showVariantDialog}
        onClose={() => setShowVariantDialog(false)}
        category={selectedCategoryForVariants}
        product={selectedProductForVariants}
        onVariantSelect={handleVariantSelect}
        mode="search"
      />
    </Dialog>
  );
}
