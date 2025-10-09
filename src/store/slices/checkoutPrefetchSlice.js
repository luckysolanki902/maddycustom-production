import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'idle', // 'idle' | 'pending' | 'ready' | 'partial' | 'failed'
  signature: null,
  lastUpdated: 0,
  errors: {},
  metrics: {
    startedAt: 0,
    readyAt: 0,
  },
};

const checkoutPrefetchSlice = createSlice({
  name: 'checkoutPrefetch',
  initialState,
  reducers: {
    prefetchStart: (state, action) => {
      const { signature } = action.payload;
      state.status = 'pending';
      state.signature = signature;
      state.errors = {};
      state.metrics.startedAt = Date.now();
    },
    prefetchPartial: (state, action) => {
      const { signature, errors = {} } = action.payload || {};
      if (signature && state.signature !== signature) return; // ignore stale
      state.status = 'partial';
      state.errors = { ...state.errors, ...errors };
      state.lastUpdated = Date.now();
    },
    prefetchReady: (state, action) => {
      const { signature } = action.payload || {};
      if (signature && state.signature && state.signature !== signature) return; // ignore stale
      state.status = 'ready';
      state.errors = {};
      state.lastUpdated = Date.now();
      state.metrics.readyAt = Date.now();
    },
    prefetchFailed: (state, action) => {
      const { signature, errors = {} } = action.payload || {};
      if (signature && state.signature !== signature) return; // ignore stale
      state.status = 'failed';
      state.errors = errors;
      state.lastUpdated = Date.now();
    },
    prefetchReset: () => initialState,
  }
});

export const {
  prefetchStart,
  prefetchPartial,
  prefetchReady,
  prefetchFailed,
  prefetchReset,
} = checkoutPrefetchSlice.actions;

export default checkoutPrefetchSlice.reducer;
