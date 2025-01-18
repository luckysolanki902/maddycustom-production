// @/store/slices/userBehaviorSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  timeSpentOnWebsite: 0, // in seconds
  scrolledMoreThan60Percent: false,
  pathnamesVisited: [], // array of strings
};

const userBehaviorSlice = createSlice({
  name: 'userBehavior',
  initialState,
  reducers: {
    incrementTimeSpent: (state) => {
      state.timeSpentOnWebsite += 1;
    },
    setScrolledMoreThan60Percent: (state, action) => {
      state.scrolledMoreThan60Percent = action.payload;
    },
    addPathnameVisited: (state, action) => {
      if (!state.pathnamesVisited.includes(action.payload)) {
        state.pathnamesVisited.push(action.payload);
      }
    },
    resetUserBehavior: () => initialState,
  },
});

export const {
  incrementTimeSpent,
  setScrolledMoreThan60Percent,
  addPathnameVisited,
  resetUserBehavior,
} = userBehaviorSlice.actions;

export default userBehaviorSlice.reducer;
