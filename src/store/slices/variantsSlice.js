import { createSlice } from '@reduxjs/toolkit';

const variantsSlice = createSlice({
  name: 'variants',
  initialState: {
    cache: {}, // categoryId -> variants data
    lastUpdated: {}, // categoryId -> timestamp
  },
  reducers: {
    setVariantsCache: (state, action) => {
      const { categoryId, data } = action.payload;
      state.cache[categoryId] = data;
      state.lastUpdated[categoryId] = Date.now();
    },
    clearVariantsCache: (state) => {
      state.cache = {};
      state.lastUpdated = {};
    },
    removeExpiredCache: (state) => {
      const now = Date.now();
      const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
      
      Object.keys(state.lastUpdated).forEach(categoryId => {
        if (now - state.lastUpdated[categoryId] > CACHE_DURATION) {
          delete state.cache[categoryId];
          delete state.lastUpdated[categoryId];
        }
      });
    },
  },
});

export const { setVariantsCache, clearVariantsCache, removeExpiredCache } = variantsSlice.actions;
export default variantsSlice.reducer;