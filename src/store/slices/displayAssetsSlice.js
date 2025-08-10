'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  homepage: {
    data: null, // Array of display assets
    lastFetched: null, // Timestamp when data was last fetched
    isLoading: false,
  },
  'product-list': {
    data: null,
    lastFetched: null,
    isLoading: false,
  },
  'product-detail': {
    data: null,
    lastFetched: null,
    isLoading: false,
  },
};

const displayAssetsSlice = createSlice({
  name: 'displayAssets',
  initialState,
  reducers: {
    setDisplayAssetsLoading(state, action) {
      const { page } = action.payload;
      // Ensure page exists before setting isLoading
      if (!state[page]) {
        state[page] = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      }
      state[page].isLoading = action.payload.isLoading;
    },
    setDisplayAssets(state, action) {
      const { page, assets } = action.payload;
      
      // Don't store cache if in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        return;
      }
      
      // Don't store cache if there are no assets
      if (!assets || assets.length === 0) {
        return;
      }
      
      // Ensure page exists before setting data
      if (!state[page]) {
        state[page] = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      }
      state[page].data = assets;
      state[page].lastFetched = Date.now();
      state[page].isLoading = false;
    },
    clearDisplayAssets(state, action) {
      const { page } = action.payload;
      if (state[page]) {
        state[page].data = null;
        state[page].lastFetched = null;
        state[page].isLoading = false;
      }
    },
    clearAllDisplayAssets(state) {
      Object.keys(state).forEach(page => {
        state[page] = {
          data: null,
          lastFetched: null,
          isLoading: false,
        };
      });
    },
  },
});

export const { 
  setDisplayAssetsLoading, 
  setDisplayAssets, 
  clearDisplayAssets, 
  clearAllDisplayAssets 
} = displayAssetsSlice.actions;

export default displayAssetsSlice.reducer;
