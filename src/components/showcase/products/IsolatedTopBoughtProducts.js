'use client';

import React, { memo } from 'react';
import TopBoughtProducts from './TopBoughtProducts';

// Completely isolated TopBoughtProducts wrapper that prevents all re-renders
// eslint-disable-next-line react/display-name
const IsolatedTopBoughtProducts = memo(({ singleVariantCode, pageType = "products-list", hideHeading = false }) => {
  return (
    <TopBoughtProducts 
      singleVariantCode={singleVariantCode} 
      pageType={pageType}
      hideHeading={hideHeading}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if singleVariantCode changes
  return prevProps.singleVariantCode === nextProps.singleVariantCode &&
         prevProps.pageType === nextProps.pageType &&
         prevProps.hideHeading === nextProps.hideHeading;
});

export default IsolatedTopBoughtProducts;
