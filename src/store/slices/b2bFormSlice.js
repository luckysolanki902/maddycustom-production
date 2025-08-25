// src/store/slices/b2bFormSlice.js
'use client';
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  dialogOpen: false,
  businessName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  role: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  notes: ''
};

const b2bFormSlice = createSlice({
  name: 'b2bForm',
  initialState,
  reducers: {
    setField: (state, action) => {
      const { field, value } = action.payload;
      if (field in state) state[field] = value;
    },
    setMany: (state, action) => {
      Object.entries(action.payload || {}).forEach(([k,v]) => { if (k in state) state[k] = v; });
    },
    resetForm: (state) => {
      Object.assign(state, initialState, { dialogOpen: state.dialogOpen });
    },
    setDialogOpen: (state, action) => { state.dialogOpen = action.payload; }
  }
});

export const { setField, setMany, resetForm, setDialogOpen } = b2bFormSlice.actions;
export default b2bFormSlice.reducer;