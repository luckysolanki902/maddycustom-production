'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: false,
  isSearchDialogOpen: false,
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
  },
});

export const {
  toggleSidebar,
  openSidebar,
  closeSidebar,
  toggleSearchDialog,
  openSearchDialog,
  closeSearchDialog,
} = uiSlice.actions;

export default uiSlice.reducer;
