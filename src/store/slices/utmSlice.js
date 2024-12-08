// src/store/slices/utmSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  utmDetails: {
    source: 'direct',    // Default value
    medium: null,
    campaign: null,
    term: null,
    content: null,
  },
};

const utmSlice = createSlice({
  name: 'utm',
  initialState,
  reducers: {
    setUTMDetails: (state, action) => {
      state.utmDetails = { ...state.utmDetails, ...action.payload };
    },
    clearUTMDetails: (state) => {
      state.utmDetails = {
        source: 'direct',
        medium: null,
        campaign: null,
        term: null,
        content: null,
      };
    },
  },
});

export const { setUTMDetails, clearUTMDetails } = utmSlice.actions;

export default utmSlice.reducer;
