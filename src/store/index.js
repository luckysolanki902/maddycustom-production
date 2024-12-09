// src/store/index.js

import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import cartReducer from './slices/cartSlice';
import orderFormReducer from './slices/orderFormSlice';
import utmReducer from './slices/utmSlice';
import variantPreferenceReducer from './slices/variantPreferenceSlice';
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
import storage from 'redux-persist/lib/storage'; // Uses localStorage

const rootReducer = combineReducers({
  cart: cartReducer,
  orderForm: orderFormReducer,
  utm: utmReducer,
  variantPreference: variantPreferenceReducer, 
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['cart', 'orderForm', 'utm', 'variantPreference'], // Persist the new slice
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
