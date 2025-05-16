'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: false,
  isSearchDialogOpen: false,
  isCartDrawerOpen: false, // New state for cart drawer
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
    // New reducers for cart drawer
    toggleCartDrawer(state) {
      state.isCartDrawerOpen = !state.isCartDrawerOpen;
    },
    openCartDrawer(state) {
      state.isCartDrawerOpen = true;
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
