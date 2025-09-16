import { createSlice } from '@reduxjs/toolkit';

const NOTIFICATION_EXPIRY_DAYS = 7;

// Helper function to check if a notification is expired
const isNotificationExpired = (timestamp) => {
  if (!timestamp) return true;
  const expiryTime = timestamp + (NOTIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return Date.now() > expiryTime;
};

// Helper function to generate a unique key for notification tracking
const generateNotificationKey = (product, selectedOption = null) => {
  let key = `product_${product._id}`;
  
  // If there's a selected option, include its inventory ID or SKU
  if (selectedOption?.inventoryData?._id) {
    key += `_option_${selectedOption.inventoryData._id}`;
  } else if (selectedOption?.sku) {
    key += `_option_${selectedOption.sku}`;
  } else if (product.inventoryData?._id) {
    key += `_inventory_${product.inventoryData._id}`;
  }
  
  return key;
};

const initialState = {
  // User's persistent phone number
  userPhone: null,
  phoneVerified: false,
  phoneLastUpdated: null,
  
  // Notification subscriptions with expiry tracking
  subscriptions: {
    // Format: { [notificationKey]: { timestamp, productId, optionId, inventoryId, phoneNumber } }
  },
  
  // UI state
  isLoading: false,
  error: null,
  lastCleanupTime: null,
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    // Set user's phone number
    setUserPhone: (state, action) => {
      const { phoneNumber, verified = false } = action.payload;
      state.userPhone = phoneNumber;
      state.phoneVerified = verified;
      state.phoneLastUpdated = Date.now();
      state.error = null;
    },

    // Clear user's phone number
    clearUserPhone: (state) => {
      state.userPhone = null;
      state.phoneVerified = false;
      state.phoneLastUpdated = null;
    },

    // Add a notification subscription
    addNotificationSubscription: (state, action) => {
      const { product, selectedOption, phoneNumber, timestamp = Date.now() } = action.payload;
      
      const notificationKey = generateNotificationKey(product, selectedOption);
      
      state.subscriptions[notificationKey] = {
        timestamp,
        productId: product._id,
        productName: product.name || product.title,
        optionId: selectedOption?._id || null,
        optionSku: selectedOption?.sku || null,
        inventoryId: selectedOption?.inventoryData?._id || product.inventoryData?._id || null,
        phoneNumber,
        variantCode: product.variantDetails?.variantCode || null,
        categoryId: product.category?._id || null,
      };
      
      // Update user phone if provided
      if (phoneNumber && phoneNumber !== state.userPhone) {
        state.userPhone = phoneNumber;
        state.phoneLastUpdated = Date.now();
      }
      
      state.error = null;
    },

    // Remove a notification subscription
    removeNotificationSubscription: (state, action) => {
      const { product, selectedOption } = action.payload;
      const notificationKey = generateNotificationKey(product, selectedOption);
      delete state.subscriptions[notificationKey];
    },

    // Check if user is subscribed to notifications for a specific product/option
    checkSubscriptionStatus: (state, action) => {
      // This is handled in selectors, but we can add UI state here if needed
    },

    // Clean up expired notifications
    cleanupExpiredNotifications: (state) => {
      const currentTime = Date.now();
      const validSubscriptions = {};
      
      Object.entries(state.subscriptions).forEach(([key, subscription]) => {
        if (!isNotificationExpired(subscription.timestamp)) {
          validSubscriptions[key] = subscription;
        }
      });
      
      state.subscriptions = validSubscriptions;
      state.lastCleanupTime = currentTime;
    },

    // Set loading state
    setNotificationLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    // Set error state
    setNotificationError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Clear error state
    clearNotificationError: (state) => {
      state.error = null;
    },

    // Bulk update subscriptions (for data migration)
    bulkUpdateSubscriptions: (state, action) => {
      const { subscriptions } = action.payload;
      state.subscriptions = { ...state.subscriptions, ...subscriptions };
    },

    // Reset entire notification state
    resetNotificationState: (state) => {
      return initialState;
    },
  },
});

// Selectors
export const selectUserPhone = (state) => state.notification?.userPhone;
export const selectPhoneVerified = (state) => state.notification?.phoneVerified;
export const selectNotificationLoading = (state) => state.notification?.isLoading;
export const selectNotificationError = (state) => state.notification?.error;

// Check if user is subscribed to notifications for a specific product/option
export const selectIsSubscribedToNotification = (product, selectedOption = null) => (state) => {
  const notificationKey = generateNotificationKey(product, selectedOption);
  const subscription = state.notification?.subscriptions?.[notificationKey];
  
  if (!subscription) return false;
  return !isNotificationExpired(subscription.timestamp);
};

// Get all active subscriptions
export const selectActiveSubscriptions = (state) => {
  const subscriptions = state.notification?.subscriptions || {};
  const activeSubscriptions = {};
  
  Object.entries(subscriptions).forEach(([key, subscription]) => {
    if (!isNotificationExpired(subscription.timestamp)) {
      activeSubscriptions[key] = subscription;
    }
  });
  
  return activeSubscriptions;
};

// Get subscription count
export const selectSubscriptionCount = (state) => {
  return Object.keys(selectActiveSubscriptions(state)).length;
};

// Check if subscriptions need cleanup
export const selectNeedsCleanup = (state) => {
  const lastCleanup = state.notification?.lastCleanupTime || 0;
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  return lastCleanup < oneHourAgo;
};

// Export actions
export const {
  setUserPhone,
  clearUserPhone,
  addNotificationSubscription,
  removeNotificationSubscription,
  checkSubscriptionStatus,
  cleanupExpiredNotifications,
  setNotificationLoading,
  setNotificationError,
  clearNotificationError,
  bulkUpdateSubscriptions,
  resetNotificationState,
} = notificationSlice.actions;

// Export helper function for external use
export { generateNotificationKey, isNotificationExpired };

export default notificationSlice.reducer;