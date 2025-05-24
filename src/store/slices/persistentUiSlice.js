'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  shippingTimer: {
    startTime: null, // Timestamp when the timer started
    duration: null,  // Duration of the timer in milliseconds
  },
};

const persistentUiSlice = createSlice({
  name: 'persistentUi',
  initialState,
  reducers: {
    startShippingTimer(state, action) {
      // action.payload should be { startTime: number, duration: number }
      state.shippingTimer.startTime = action.payload.startTime;
      state.shippingTimer.duration = action.payload.duration;
    },
    clearShippingTimer(state) {
      state.shippingTimer.startTime = null;
      state.shippingTimer.duration = null;
    },
  },
});

export const { startShippingTimer, clearShippingTimer } = persistentUiSlice.actions;

export default persistentUiSlice.reducer;
