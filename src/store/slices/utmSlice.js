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
  utmHistory: [], // New field to track UTM history
};

const utmSlice = createSlice({
  name: 'utm',
  initialState,
  reducers: {
    setUTMDetails: (state, action) => {
      const override = action.payload.override === true;
      
      // Create a clean version of the UTM parameters without the override flag
      // and other non-UTM related fields for both main params and history
      const utmParams = {
        source: action.payload.source || state.utmDetails.source,
        medium: action.payload.medium || state.utmDetails.medium,
        campaign: action.payload.campaign || state.utmDetails.campaign,
        term: action.payload.term || state.utmDetails.term,
        content: action.payload.content || state.utmDetails.content,
        fbc: action.payload.fbc || state.utmDetails.fbc,
      };
      
      // Only update the main UTM details if:
      // 1. Override flag is true, OR
      // 2. UTM details have not been set yet (isSet is false)
      if (override || !state.isSet) {
        state.utmDetails = { ...utmParams };
        state.isSet = true; // Mark as set
      }
      
      // Always create history entry with additional metadata (but no override flag)
      const historyEntry = {
        ...utmParams, // Use the clean UTM params
        pathname: action.payload.pathname || null,
        timestamp: new Date().toISOString(),
        queryParams: action.payload.queryParams || null,
      };
      
      // Check if the current entry has any actual UTM parameters
      const hasUtmParams = historyEntry.source !== 'direct' || 
                          historyEntry.medium || 
                          historyEntry.campaign || 
                          historyEntry.term || 
                          historyEntry.content || 
                          historyEntry.fbc;
      
      // Only add to history if it has UTM parameters
      if (hasUtmParams) {
        // Add to history if it's different from the last entry
        const lastEntry = state.utmHistory.length > 0 
          ? state.utmHistory[state.utmHistory.length - 1] 
          : null;

        // Check if current entry has different UTM parameters compared to the last entry
        const isDifferent = !lastEntry || 
          historyEntry.source !== lastEntry.source || 
          historyEntry.medium !== lastEntry.medium || 
          historyEntry.campaign !== lastEntry.campaign || 
          historyEntry.term !== lastEntry.term || 
          historyEntry.content !== lastEntry.content || 
          historyEntry.fbc !== lastEntry.fbc;
        
        // Add to history only if different from last entry
        if (isDifferent) {
          state.utmHistory.push(historyEntry);
        }
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
      state.utmHistory = [];
    },
    clearUTMHistory: (state) => {
      state.utmHistory = []; // Clear history but keep current UTM details
    },
    logUtmDetails: (state) => {
      const utmString = Object.entries(state.utmDetails)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      
      state.utmHistory.forEach((entry, index) => {
      });
      
      return state;
    },
  },
});

export const { setUTMDetails, clearUTMDetails, clearUTMHistory, logUtmDetails } = utmSlice.actions;

export default utmSlice.reducer;
