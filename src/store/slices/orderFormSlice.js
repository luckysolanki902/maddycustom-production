import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userDetails: {
    name: '',
    phoneNumber: '',
    userId: '',
    localUserId: '',
  },
  addressDetails: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    floor: '',
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
};

const orderFormSlice = createSlice({
  name: 'orderForm',
  initialState,
  reducers: {
    // -------------------------------------------------- generic data
    setUserDetails: (s, a) => { s.userDetails = { ...s.userDetails, ...a.payload }; },
    setLocalUserId: (s, a) => {
      const value = a.payload || '';
      s.userDetails.localUserId = value;
    },
    setAddressDetails: (s, a) => { s.addressDetails = { ...s.addressDetails, ...a.payload }; },
    setUserExists: (s, a) => { s.userExists = a.payload; },
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

    resetOrderForm: (s) => {
      // Preserve userDetails, addressDetails, userExists, prefilledAddress
      // Reset only coupon/offer-related and small misc fields
      s.couponApplied = { ...initialState.couponApplied };
      s.manualCoupon = initialState.manualCoupon;
      s.autoApplyDisabled = initialState.autoApplyDisabled;
      s.autoApplyDisabledAt = initialState.autoApplyDisabledAt;
      s.bestDealCoupon = initialState.bestDealCoupon;
      s.extraFields = { ...initialState.extraFields };
      s.loginDialogShown = initialState.loginDialogShown;
      s.lastOrderId = initialState.lastOrderId;
      s.lastOrderIdSetAt = initialState.lastOrderIdSetAt;
    },
  },
});

export const {
  setUserDetails,
  setLocalUserId,
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
  resetOrderForm,
} = orderFormSlice.actions;

export default orderFormSlice.reducer;
