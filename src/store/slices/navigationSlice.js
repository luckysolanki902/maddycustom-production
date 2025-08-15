import { createSlice } from '@reduxjs/toolkit';

const navigationSlice = createSlice({
  name: 'navigation',
  initialState: {
    isLoading: false,
    progress: 0,
    loadingActive: false, // Prevents double triggers
    navigationStartTime: null,
    currentUrl: null,
    pendingNavigation: null
  },
  reducers: {
    startNavigation: (state, action) => {
      // Prevent double triggers
      if (state.loadingActive) return;

      state.isLoading = true;
      state.progress = 0;
      state.loadingActive = true;
      state.navigationStartTime = Date.now();
      state.pendingNavigation = action.payload?.url || null;
    },
    
    updateProgress: (state, action) => {
      if (state.loadingActive) {
        state.progress = Math.min(action.payload, 95); // Cap at 95% until completion
      }
    },
    
    completeNavigation: (state) => {
      state.progress = 100;
      state.isLoading = false;
      state.loadingActive = false;
      state.navigationStartTime = null;
      state.pendingNavigation = null;
    },
    
    cancelNavigation: (state) => {
      state.isLoading = false;
      state.progress = 0;
      state.loadingActive = false;
      state.navigationStartTime = null;
      state.pendingNavigation = null;
    },
    
    setCurrentUrl: (state, action) => {
      state.currentUrl = action.payload;
    }
  }
});

export const { 
  startNavigation, 
  updateProgress, 
  completeNavigation, 
  cancelNavigation,
  setCurrentUrl 
} = navigationSlice.actions;

export default navigationSlice.reducer;