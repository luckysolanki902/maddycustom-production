// @/lib/auth/authSelectors.js
'use client';

// Auth state selectors for easy selection from Redux store
export const selectIsAuthenticated = state => !!state.auth?.user;
export const selectUser = state => state.auth?.user || null;
export const selectAuthLoading = state => state.auth?.isLoading;
export const selectAuthError = state => state.auth?.error;
export const selectHasValidAddress = state => {
  // Check if user has at least one address
  return state.auth?.user?.addresses?.length > 0;
};
export const selectPrimaryAddress = state => {
  if (!state.auth?.user?.addresses) return null;
  return state.auth.user.addresses.find(addr => addr.isPrimary) || state.auth.user.addresses[0];
};
