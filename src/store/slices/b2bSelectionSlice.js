// src/store/slices/b2bSelectionSlice.js
'use client';
import { createSlice } from '@reduxjs/toolkit';

/* Each selected item: {
  productId, optionId, sku, name, quantity, thumbnail, wrapFinish
} */

const b2bSelectionSlice = createSlice({
  name: 'b2bSelection',
  initialState: {
    items: []
  },
  reducers: {
    upsertB2BItem: (state, action) => {
      let { productId, optionId, sku, name, quantity, thumbnail, wrapFinish, category, subCategory } = action.payload;
      // Normalize undefined / null option ids so we don't create duplicates
      optionId = optionId ?? null;
      const q = parseInt(quantity, 10) || 0;

      // Dedupe any legacy duplicates for this product (from earlier null/undefined mismatch)
      let firstIndex = -1;
      for (let i = state.items.length - 1; i >= 0; i--) {
        const it = state.items[i];
        if (it.productId === productId) {
          if (firstIndex === -1) {
            firstIndex = i; // keep the last (most recently added) item
          } else {
            // Merge quantity preference: keep the max
            if (state.items[i].quantity > state.items[firstIndex].quantity) {
              state.items[firstIndex].quantity = state.items[i].quantity;
            }
            state.items.splice(i, 1);
          }
        }
      }

      const existingIndex = state.items.findIndex(i => i.productId === productId && (i.optionId == optionId)); // loose equality on purpose

      // Retain item even if quantity is 0 (user might set later); only remove if negative
      if (q < 0) {
        if (existingIndex !== -1) state.items.splice(existingIndex, 1);
        return;
      }
      if (existingIndex === -1) {
        state.items.push({ productId, optionId, sku, name, quantity: q, thumbnail, wrapFinish, category, subCategory });
      } else {
        const target = state.items[existingIndex];
        target.quantity = q;
        target.thumbnail = thumbnail;
        target.sku = sku;
        target.name = name;
        target.wrapFinish = wrapFinish;
        target.category = category;
        target.subCategory = subCategory;
      }
    },
    clearB2BSelection: (state) => { state.items = []; }
  }
});

export const { upsertB2BItem, clearB2BSelection } = b2bSelectionSlice.actions;
export default b2bSelectionSlice.reducer;
