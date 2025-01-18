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
  couponApplied: {
    couponCode: '',
    discountAmount: 0
  },
  lastOrderId: '',
  lastOrderIdSetAt: null,
  extraFields: {}, 
  loginDialogShown: false, // Added field to track if dialog was shown
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
    setCouponApplied: (state, action) => {
      state.couponApplied = { ...state.couponApplied, ...action.payload };
    },
    setLastOrderId: (state, action) => {
      state.lastOrderId = action.payload;
    },
    setExtraFields: (state, action) => {
      state.extraFields = { ...state.extraFields, ...action.payload };
    },
    setLoginDialogShown: (state, action) => {
      state.loginDialogShown = action.payload;
    },
    resetOrderForm: () => initialState,
  },
});

export const {
  setUserDetails,
  setAddressDetails,
  setUserExists,
  setPrefilledAddress,
  setCouponApplied,
  setLastOrderId, 
  setExtraFields,
  setLoginDialogShown,
  resetOrderForm,
} = orderFormSlice.actions;

export default orderFormSlice.reducer;
