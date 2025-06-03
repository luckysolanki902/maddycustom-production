import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userDetails: {
    name: '',
    phoneNumber: '',
    userId: '',
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

  // ⇣  coupon fields  ⇣
  couponApplied: {
    couponCode: '',
    discountAmount: 0,
    discountType: '',
    offer: null,
  },
  manualCoupon: null,          // last coupon the USER applied (or null)
  autoApplyDisabled: false,    // true after any manual apply/remove
  autoApplyDisabledAt: null,   // ISO timestamp when we set the flag

  lastOrderId: '',
  lastOrderIdSetAt: null,
  extraFields: {},
  loginDialogShown: false,
  // loginDialogOpen: false,
};

const orderFormSlice = createSlice({
  name: 'orderForm',
  initialState,
  reducers: {
    // -------------------------------------------------- generic data
    setUserDetails: (s, a) => { s.userDetails = { ...s.userDetails, ...a.payload }; },
    setAddressDetails: (s, a) => { s.addressDetails = { ...s.addressDetails, ...a.payload }; },
    // setUserExists: (s, a) => { s.userExists = a.payload; },
    setUserExists: (state, action) => {
      state.userExists = action.payload;
    },
    
    setPrefilledAddress: (s, a) => { s.prefilledAddress = a.payload; },

    // -------------------------------------------------- coupon workflow
    setCouponApplied: (s, a) => {
      s.couponApplied = { ...s.couponApplied, ...a.payload };
    },

    // USER typed a code or clicked “Remove”
    setManualCoupon: (s, a) => {
      s.manualCoupon = a.payload ? { ...a.payload } : null;
      s.autoApplyDisabled = true;
      s.autoApplyDisabledAt = new Date().toISOString();  // block 5 min
    },

    // clear the 5‑minute block when we really need to
    resetAutoApplyDisabled: (s) => {
      s.autoApplyDisabled = false;
      s.autoApplyDisabledAt = null;
    },

    // Save best deal coupon for display purposes
    setBestDealCoupon: (s, a) => { 
      s.bestDealCoupon = a.payload; 
    },

    // -------------------------------------------------- misc
    setLastOrderId: (s, a) => { s.lastOrderId = a.payload; },
    setExtraFields: (s, a) => { s.extraFields = { ...s.extraFields, ...a.payload }; },
    setLoginDialogShown: (s, a) => { s.loginDialogShown = a.payload; },
    // setLoginDialogOpen: (s, a) => { s.loginDialogOpen = a.payload; },
    resetOrderForm: () => initialState,
  },
});

export const {
  setUserDetails,
  setAddressDetails,
  setUserExists,
  setPrefilledAddress,
  setCouponApplied,
  setManualCoupon,
  resetAutoApplyDisabled,
  setBestDealCoupon,
  setLastOrderId,
  setExtraFields,
  setLoginDialogShown,
  // setLoginDialogOpen,
  resetOrderForm,
} = orderFormSlice.actions;

export default orderFormSlice.reducer;
