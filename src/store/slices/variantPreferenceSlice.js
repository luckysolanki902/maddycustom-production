// src/store/slices/variantPreferenceSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // structure: [specificCategoryId]: { preferredVariantId, variantCode, pageSlug, hasSeenVariantPopup }
};

const variantPreferenceSlice = createSlice({
  name: 'variantPreference',
  initialState,
  reducers: {
    setPageSlug: (state, action) => {
      const { categoryId, pageSlug } = action.payload;
      if (!state[categoryId]) {
        state[categoryId] = { pageSlug: '', hasSeenVariantPopup: false };
      }
      // Ensure the pageSlug starts with "/shop"
      state[categoryId].pageSlug = pageSlug.startsWith('/shop') ? pageSlug : `/shop${pageSlug}`;
    },
    setPreferredVariant: (state, action) => {
      const { categoryId, variantId, variantCode } = action.payload;
      if (!state[categoryId]) {
        state[categoryId] = { pageSlug: '', hasSeenVariantPopup: false };
      }
      state[categoryId].preferredVariantId = variantId;
      if (variantCode) state[categoryId].variantCode = variantCode;
    },
    setHasSeenVariantPopup: (state, action) => {
      const { categoryId, hasSeen } = action.payload;
      if (!state[categoryId]) {
        state[categoryId] = { pageSlug: '', hasSeenVariantPopup: false };
      }
      state[categoryId].hasSeenVariantPopup = hasSeen;
    },
    // Generic reducer for additional preferences
    setPreference: (state, action) => {
      const { categoryId, key, value } = action.payload;
      if (!state[categoryId]) {
        state[categoryId] = { pageSlug: '', hasSeenVariantPopup: false };
      }
      // If the key is 'pageSlug', ensure it starts with "/shop"
      if (key === 'pageSlug') {
        state[categoryId][key] = value.startsWith('/shop') ? value : `/shop${value}`;
      } else {
        state[categoryId][key] = value;
      }
    },
  },
});

export const { setPageSlug, setHasSeenVariantPopup, setPreference, setPreferredVariant } = variantPreferenceSlice.actions;

export default variantPreferenceSlice.reducer;
