// @/store/slices/cartSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [], // Each item: { productId, quantity, productDetails, insertionDetails }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      const { productId, productDetails, insertionDetails } = action.payload;
      const existingItem = state.items.find((item) => item.productId === productId);
      if (existingItem) {
        existingItem.quantity += 1;
        // Update insertion details if provided
        if (insertionDetails) {
          existingItem.insertionDetails = insertionDetails;
        }
      } else {
        state.items.push({ 
          productId, 
          quantity: 1, 
          productDetails,
          insertionDetails: insertionDetails || {} 
        });
      }
    },
    removeItem: (state, action) => {
      const { productId } = action.payload;
      state.items = state.items.filter((item) => item.productId !== productId);
    },
    incrementQuantity: (state, action) => {
      const { productId } = action.payload;
      const item = state.items.find((item) => item.productId === productId);
      if (item) {
        item.quantity += 1;
      }
    },
    decrementQuantity: (state, action) => {
      const { productId } = action.payload;
      const item = state.items.find((item) => item.productId === productId);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
      } else if (item) {
        state.items = state.items.filter((item) => item.productId !== productId);
      }
    },
    setCart: (state, action) => {
      state.items = action.payload;
    },
    clearCart: (state) => {
      state.items = [];
    },
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const itemIndex = state.items.findIndex(item => 
        (item.productId === productId || item.productDetails?._id === productId)
      );
      
      if (itemIndex !== -1) {
        state.items[itemIndex].quantity = quantity;
      }
    },
    setDefaultWrapFinish: (state) => {
      state.items = state.items.map(item => {
        const categoryName = item.productDetails?.category?.name?.toLowerCase();

        if ((categoryName?.includes('wrap')|| categoryName?.includes('Wrap')) && !item.productDetails.wrapFinish) {
          console.log("added wrapfiish");
          return {
            ...item,
            productDetails: {
              ...item.productDetails,
              wrapFinish: 'Matte',
            },
          };
        }
        return item;
      });
    },
  },
});

export const {
  addItem,
  removeItem,
  incrementQuantity,
  decrementQuantity,
  setCart,
  clearCart,
  updateQuantity,
  setDefaultWrapFinish
} = cartSlice.actions;

export default cartSlice.reducer;
