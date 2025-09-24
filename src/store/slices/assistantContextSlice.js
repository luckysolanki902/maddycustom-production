import { createSlice } from '@reduxjs/toolkit';

// Holds high-level browsing context for AI assistant (not persisted)
// pageType: 'product_list' | 'product_detail' | 'home' | 'other'
// categoryTitle: human readable category / specific category name
// productTitle: current product title if on product detail page
// variantTitle: variant name if applicable
// lastUpdated: ISO timestamp for change debouncing if needed
const initialState = {
  pageType: 'other',
  categoryTitle: null,
  productTitle: null,
  variantTitle: null,
  lastUpdated: null,
  categories: null, // cached available categories [{id,name,title,pageSlug,classificationTags}]
  categoriesFetchedAt: null,
};

const assistantContextSlice = createSlice({
  name: 'assistantContext',
  initialState,
  reducers: {
    setAssistantContext(state, action) {
      const { pageType, categoryTitle, productTitle, variantTitle } = action.payload || {};
      state.pageType = pageType || state.pageType;
      state.categoryTitle = categoryTitle ?? state.categoryTitle;
      state.productTitle = productTitle ?? state.productTitle;
      state.variantTitle = variantTitle ?? state.variantTitle;
      state.lastUpdated = new Date().toISOString();
    },
    setAssistantCategories(state, action) {
      state.categories = action.payload || [];
      state.categoriesFetchedAt = new Date().toISOString();
    },
    resetAssistantContext() {
      return { ...initialState, lastUpdated: new Date().toISOString() };
    }
  }
});

export const { setAssistantContext, resetAssistantContext, setAssistantCategories } = assistantContextSlice.actions;
export default assistantContextSlice.reducer;