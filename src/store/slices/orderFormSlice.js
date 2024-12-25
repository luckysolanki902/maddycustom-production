// @/store/slices/orderFormSlice.js

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userDetails: {
    name: '',
    phoneNumber: '',
    userId: '', // Added userId
  },
  addressDetails: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  },
  userExists: false,
  prefilledAddress: null,
  couponsApplied: {
    couponCode: '',
    discountAmount: 0
  },
  lastOrderId: '',
};

const orderFormSlice = createSlice({
  name: 'orderForm',
  initialState,
  reducers: {
    setUserDetails: (state, action) => {
      state.userDetails = { ...state.userDetails, ...action.payload };
    },
    setAddressDetails: (state, action) => {
      state.addressDetails = { ...state.addressDetails, ...action.payload };
    },
    setUserExists: (state, action) => {
      state.userExists = action.payload;
    },
    setPrefilledAddress: (state, action) => {
      state.prefilledAddress = action.payload;
    },
    setCouponsApplied: (state, action) => {
      state.couponsApplied = { ...state.couponsApplied, ...action.payload };
    },
    setLastOrderId: (state, action) => {
      state.lastOrderId = action.payload;
    },
    resetOrderForm: () => initialState,
  },

});

export const {
  setUserDetails,
  setAddressDetails,
  setUserExists,
  setPrefilledAddress,
  setLastOrderId, // Exported setLastOrderId action
  resetOrderForm,
  setCouponsApplied
} = orderFormSlice.actions;

export default orderFormSlice.reducer;
