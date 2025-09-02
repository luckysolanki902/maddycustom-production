'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: false,
  isSearchDialogOpen: false,
  isCartDrawerOpen: false,
  cartDrawerSource: "bottom", // 'top' or 'bottom'
  isRecommendationDrawerOpen: false,
  recommendationProduct: null,
  hasSeenRecommendationDrawer: false,
  shippingTimer: {
    expiryTime: Date.now() + 9 * 60 * 60 * 1000 + 13 * 60 * 1000, // 9 hours 13 minutes from now
    isActive: false,
  },
  topStrip: {
    show: false,
    categoryId: null,
    data: null,
  },
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
      state.isSidebarOpen = fal
      se;
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
    
    // Recommendation drawer reducers
    openRecommendationDrawer(state, action) {
      state.isRecommendationDrawerOpen = true;
      state.recommendationProduct = action.payload?.product || null;
  state.hasSeenRecommendationDrawer = true;
    },
    closeRecommendationDrawer(state) {
      state.isRecommendationDrawerOpen = false;
      state.recommendationProduct = null;
    },
    markRecommendationDrawerSeen(state){
      state.hasSeenRecommendationDrawer = true;
    },
    
    // New shipping timer reducers
    setShippingTimer: (state, action) => {
      state.shippingTimer.expiryTime = action.payload;
      state.shippingTimer.isActive = true;
    },
    expireShippingTimer: (state) => {
      state.shippingTimer.isActive = false;
    },
    resetShippingTimer: (state) => {
      state.shippingTimer.expiryTime = Date.now() + (9 * 60 * 60 * 1000) + (13 * 60 * 1000);
      state.shippingTimer.isActive = true;
    },
    // New reducer for closing everything
    closeAllDialogs(state) {
      state.isCartDrawerOpen = false;
      state.isSidebarOpen = false;
      state.isSearchDialogOpen = false;
      state.isRecommendationDrawerOpen = false;
      state.recommendationProduct = null;
    },
    
    // TopStrip reducers
    showTopStrip(state, action) {
      state.topStrip.show = true;
      state.topStrip.categoryId = action.payload?.categoryId || null;
      state.topStrip.data = action.payload?.data || null;
    },
    hideTopStrip(state) {
      state.topStrip.show = false;
      state.topStrip.categoryId = null;
      state.topStrip.data = null;
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
  openRecommendationDrawer,
  closeRecommendationDrawer,
  markRecommendationDrawerSeen,
  setShippingTimer,
  expireShippingTimer,
  resetShippingTimer,
  closeAllDialogs,
  showTopStrip,
  hideTopStrip
} = uiSlice.actions;

export default uiSlice.reducer;
