// @/store/slices/userBehaviorSlice.js

import { createSlice } from '@reduxjs/toolkit';

// Initialize time from sessionStorage to persist across page navigation within the same session
const getInitialTimeSpent = () => {
  if (typeof window === 'undefined') return 0;
  const stored = sessionStorage.getItem('timeSpentOnWebsite');
  return stored ? parseInt(stored, 10) : 0;
};

const getInitialScrolled = () => {
  if (typeof window === 'undefined') return false;
  const stored = sessionStorage.getItem('scrolledMoreThan60Percent');
  return stored === 'true';
};

const getSessionFlag = () => {
  if (typeof window === 'undefined') return false;
  const stored = sessionStorage.getItem('subscribeDialogShownThisSession');
  return stored === 'true';
};

const initialState = {
  timeSpentOnWebsite: getInitialTimeSpent(), // in seconds, persisted in session
  scrolledMoreThan60Percent: getInitialScrolled(), // persisted in session
  pathnamesVisited: [], // array of strings
  subscribeDialogShownThisSession: getSessionFlag(), // Track if dialog was shown in current session
};

const userBehaviorSlice = createSlice({
  name: 'userBehavior',
  initialState,
  reducers: {
    incrementTimeSpent: (state) => {
      state.timeSpentOnWebsite += 1;
      // Store in sessionStorage to persist across page navigation within the same session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('timeSpentOnWebsite', state.timeSpentOnWebsite.toString());
      }
    },
    setScrolledMoreThan60Percent: (state, action) => {
      state.scrolledMoreThan60Percent = action.payload;
      // Store in sessionStorage to persist across page navigation within the same session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('scrolledMoreThan60Percent', action.payload.toString());
      }
    },
    addPathnameVisited: (state, action) => {
      if (!state.pathnamesVisited.includes(action.payload)) {
        state.pathnamesVisited.push(action.payload);
      }
    },
    setSubscribeDialogShownThisSession: (state, action) => {
      state.subscribeDialogShownThisSession = action.payload;
      // Store in sessionStorage to persist across page navigation within the same session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('subscribeDialogShownThisSession', action.payload.toString());
      }
    },
    resetUserBehavior: () => initialState,
  },
});

export const {
  incrementTimeSpent,
  setScrolledMoreThan60Percent,
  addPathnameVisited,
  setSubscribeDialogShownThisSession,
  resetUserBehavior,
} = userBehaviorSlice.actions;

export default userBehaviorSlice.reducer;
