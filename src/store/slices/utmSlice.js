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
    override: false,     // New field to track if override was used
  },
  isSet: false, // Flag to track if UTM details have been set
};

const utmSlice = createSlice({
  name: 'utm',
  initialState,
  reducers: {
    setUTMDetails: (state, action) => {
      // If override is true, always update UTM details
      if (action.payload.override === true || !state.isSet) {
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
        override: false,
      };
      state.isSet = false; // Reset the flag
    },
    logUtmDetails: (state) => {
      const utmString = Object.entries(state.utmDetails)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      console.log(`Current UTM Details: ${utmString}`);
      // This action doesn't change state, it only logs the current UTM details
      return state;
    },
  },
});

export const { setUTMDetails, clearUTMDetails, logUtmDetails } = utmSlice.actions;

export default utmSlice.reducer;
