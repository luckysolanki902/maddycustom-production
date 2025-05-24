'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: false,
  isSearchDialogOpen: false,
  isCartDrawerOpen: false,
  cartDrawerSource: 'bottom', // 'top' or 'bottom'
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    openSidebar(state) {
      state.isSidebarOpen = true;
    },
    closeSidebar(state) {
      state.isSidebarOpen = false;
    },
    toggleSearchDialog(state) {
      state.isSearchDialogOpen = !state.isSearchDialogOpen;
    },
    openSearchDialog(state) {
      state.isSearchDialogOpen = true;
    },
    closeSearchDialog(state) {
      state.isSearchDialogOpen = false;
    },
    // Cart drawer reducers
    toggleCartDrawer(state) {
      state.isCartDrawerOpen = !state.isCartDrawerOpen;
    },
    openCartDrawer(state, action) {
      state.isCartDrawerOpen = true;
      // Set the source based on the passed parameter or default to 'bottom'
      state.cartDrawerSource = action.payload?.source || 'bottom';
    },
    closeCartDrawer(state) {
      state.isCartDrawerOpen = false;
    },
  },
});

export const {
  toggleSidebar,
  openSidebar,
  closeSidebar,
  toggleSearchDialog,
  openSearchDialog,
  closeSearchDialog,
  toggleCartDrawer,
  openCartDrawer,
  closeCartDrawer,
} = uiSlice.actions;

export default uiSlice.reducer;
