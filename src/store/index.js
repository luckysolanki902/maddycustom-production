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
});

const persistConfig = {
  key: 'root_v7', // bump version after adding B2B persistence
  storage,
  // Persist B2B selection + form so quantities & form fields survive reloads
  whitelist: [
    'cart',
    'orderForm',
    'utm',
    'variantPreference',
    'userBehavior',
    'persistentUi',
    'displayAssets',
    'b2bSelection',
    'b2bForm'
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
