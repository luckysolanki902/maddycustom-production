'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  shippingTimer: {
    startTime: null, // Timestamp when the timer started
    duration: null,  // Duration of the timer in milliseconds
  },
  searchCategories: {
    data: null, // { categories: [], variants: [] }
    lastFetched: null, // Timestamp when data was last fetched
    isLoading: false,
  },
};

const persistentUiSlice = createSlice({
  name: 'persistentUi',
  initialState,
  reducers: {
    startShippingTimer(state, action) {
      // action.payload should be { startTime: number, duration: number }
      state.shippingTimer.startTime = action.payload.startTime;
      state.shippingTimer.duration = action.payload.duration;
    },
    clearShippingTimer(state) {
      state.shippingTimer.startTime = null;
      state.shippingTimer.duration = null;
    },
    setSearchCategoriesLoading(state, action) {
      // Ensure searchCategories exists before setting isLoading
      if (!state.searchCategories) {
        state.searchCategories = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      }
      state.searchCategories.isLoading = action.payload;
    },
    setSearchCategories(state, action) {
      // Don't store cache if in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        return;
      }
      
      // Don't store cache if there are no categories or variants
      const data = action.payload;
      if (!data || (!data.categories?.length && !data.variants?.length)) {
        return;
      }
      
      // Ensure searchCategories exists before setting data
      if (!state.searchCategories) {
        state.searchCategories = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      }
      // action.payload should be { categories: [], variants: [] }
      state.searchCategories.data = action.payload;
      state.searchCategories.lastFetched = Date.now();
      state.searchCategories.isLoading = false;
    },
    clearSearchCategories(state) {
      // Ensure searchCategories exists before clearing
      if (!state.searchCategories) {
        state.searchCategories = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      } else {
        state.searchCategories.data = null;
        state.searchCategories.lastFetched = null;
        state.searchCategories.isLoading = false;
      }
    },
  },
});

export const { 
  startShippingTimer, 
  clearShippingTimer, 
  setSearchCategoriesLoading, 
  setSearchCategories, 
  clearSearchCategories 
} = persistentUiSlice.actions;

export default persistentUiSlice.reducer;
