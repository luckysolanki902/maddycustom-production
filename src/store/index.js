// src/store/index.js

import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import cartReducer from './slices/cartSlice';
import orderFormReducer from './slices/orderFormSlice'; // Import orderFormSlice
import utmReducer from './slices/utmSlice'; // Import utmSlice
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
  orderForm: orderFormReducer, // Add orderForm to rootReducer
  utm: utmReducer, // Add utm slice to rootReducer
  // Add other reducers here if needed
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['cart', 'orderForm', 'utm'], // Persist cart, orderForm, and utm slices
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
