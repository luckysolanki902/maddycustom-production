// src/store/slices/utmSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  utmDetails: {
    source: 'direct',    // Default value
    medium: null,
    campaign: null,
    term: null,
    content: null,
    fbc: null,   
  },
  isSet: false, // Flag to track if UTM details have been set
};

const utmSlice = createSlice({
  name: 'utm',
  initialState,
  reducers: {
    setUTMDetails: (state, action) => {
      if (!state.isSet) { // Only set if not already set
        state.utmDetails = { ...state.utmDetails, ...action.payload };
        state.isSet = true; // Mark as set
      }
    },
    clearUTMDetails: (state) => {
      state.utmDetails = {
        source: 'direct',
        medium: null,
        campaign: null,
        term: null,
        content: null,
        fbc: null,
      };
      state.isSet = false; // Reset the flag
    },
  },
});

export const { setUTMDetails, clearUTMDetails } = utmSlice.actions;

export default utmSlice.reducer;
