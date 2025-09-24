'use client';

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import cartReducer from './slices/cartSlice';
import orderFormReducer from './slices/orderFormSlice';
import utmReducer from './slices/utmSlice';
import variantPreferenceReducer from './slices/variantPreferenceSlice';
import userBehaviorSlice from './slices/userBehaviorSlice';
import uiReducer from './slices/uiSlice';
import persistentUiReducer from './slices/persistentUiSlice'; // Import the new slice
import displayAssetsReducer from './slices/displayAssetsSlice'; // Import display assets slice
import navigationReducer from './slices/navigationSlice'; // Import navigation slice
import b2bSelectionReducer from './slices/b2bSelectionSlice';
import b2bFormReducer from './slices/b2bFormSlice';
import variantsReducer from './slices/variantsSlice'; // Import variants cache slice
import notificationReducer from './slices/notificationSlice'; // Import notification slice
import assistantContextReducer from './slices/assistantContextSlice';

const rootReducer = combineReducers({
  cart: cartReducer,
  orderForm: orderFormReducer,
  utm: utmReducer,
  variantPreference: variantPreferenceReducer,
  userBehavior: userBehaviorSlice,
  ui: uiReducer,
  persistentUi: persistentUiReducer, // Add the new reducer
  displayAssets: displayAssetsReducer, // Add display assets reducer
  navigation: navigationReducer, // Add navigation reducer (not persisted for real-time state)
  b2bSelection: b2bSelectionReducer,
  b2bForm: b2bFormReducer,
  variants: variantsReducer, // Add variants cache reducer
  notification: notificationReducer, // Add notification reducer
  assistantContext: assistantContextReducer, // Non-persisted context for assistant
});

const persistConfig = {
  key: 'root_v8', // bump version after adding notification persistence
  storage,
  // Persist notification state for phone and subscription tracking
  whitelist: [
    'cart',
    'orderForm',
    'utm',
    'variantPreference',
    'userBehavior',
    'persistentUi',
    'displayAssets',
    'b2bSelection',
    'b2bForm',
    'notification',
    // Do NOT persist assistantContext to avoid stale context across sessions
  ],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
