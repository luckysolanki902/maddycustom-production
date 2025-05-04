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

const rootReducer = combineReducers({
  cart: cartReducer,
  orderForm: orderFormReducer,
  utm: utmReducer,
  variantPreference: variantPreferenceReducer,
  userBehavior: userBehaviorSlice,
  ui: uiReducer,
});

const persistConfig = {
  key: 'root_v3',
  storage,
  // Do not include the UI slice here
  whitelist: ['cart', 'orderForm', 'utm', 'variantPreference', 'userBehavior'],
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
