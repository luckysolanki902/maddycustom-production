// utils.js

export const filterProductsByTag = (products, tagFilter) => {
    if (!tagFilter) return products;
    return products.filter((product) =>
      product.mainTags.some(
        (tag) => tag.trim().toLowerCase() === tagFilter.trim().toLowerCase()
      )
    );
  };
  
  export const sortProducts = (products, sortBy) => {
    const sortedProducts = [...products]; // Create a shallow copy
    sortedProducts.sort((a, b) => {
      if (sortBy === 'priceLowToHigh') {
        return a.price - b.price || a.displayOrder - b.displayOrder;
      } else if (sortBy === 'priceHighToLow') {
        return b.price - a.price || a.displayOrder - b.displayOrder;
      } else if (sortBy === 'latestFirst') {
        return new Date(b.createdAt) - new Date(a.createdAt) || a.displayOrder - b.displayOrder;
      } else if (sortBy === 'oldestFirst') {
        return new Date(a.createdAt) - new Date(b.createdAt) || a.displayOrder - b.displayOrder;
      } else {
        return a.displayOrder - b.displayOrder;
      }
    });
    return sortedProducts;
  };
  