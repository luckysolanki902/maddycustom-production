import { createSlice } from '@reduxjs/toolkit';

const variantsSlice = createSlice({
  name: 'variants',
  initialState: {
    cache: {}, // categoryId -> variants data
    lastUpdated: {}, // categoryId -> timestamp
    pendingRequests: {}, // categoryId -> promise for deduplication
  },
  reducers: {
    setVariantsCache: (state, action) => {
      const { categoryId, data } = action.payload;
      state.cache[categoryId] = data;
      state.lastUpdated[categoryId] = Date.now();
      // Clear pending request when data is cached
      delete state.pendingRequests[categoryId];
    },
    setPendingRequest: (state, action) => {
      const { categoryId } = action.payload;
      state.pendingRequests[categoryId] = true;
    },
    clearPendingRequest: (state, action) => {
      const { categoryId } = action.payload;
      delete state.pendingRequests[categoryId];
    },
    clearVariantsCache: (state) => {
      state.cache = {};
      state.lastUpdated = {};
      state.pendingRequests = {};
    },
    removeExpiredCache: (state) => {
      const now = Date.now();
      const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
      
      Object.keys(state.lastUpdated).forEach(categoryId => {
        if (now - state.lastUpdated[categoryId] > CACHE_DURATION) {
          delete state.cache[categoryId];
          delete state.lastUpdated[categoryId];
          delete state.pendingRequests[categoryId];
        }
      });
    },
  },
});

export const { 
  setVariantsCache, 
  setPendingRequest, 
  clearPendingRequest, 
  clearVariantsCache, 
  removeExpiredCache 
} = variantsSlice.actions;
export default variantsSlice.reducer;