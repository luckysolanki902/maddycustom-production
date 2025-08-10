// Example usage in your homepage or any page

import CarIntExt from '@/components/page-sections/homepage/CarIntExt';

// Instead of manually defining carousel images, the component now filters from displayAssets
// You need to have assets in your displayAssets with componentName: 'car-interior-carousel' or 'car-exterior-carousel'

export default function HomePage({ displayAssets = [] }) {
  return (
    <div>
      {/* Other homepage content */}
      
      {/* Interior Section - will look for assets with componentName: 'car-interior-carousel' */}
      <CarIntExt 
        type="interior"
        assets={displayAssets}
      />
      
      {/* Exterior Section - will look for assets with componentName: 'car-exterior-carousel' */}
      <CarIntExt 
        type="exterior"
        assets={displayAssets}
      />
      
      {/* Other homepage content */}
    </div>
  );
}

/* 
Expected displayAssets structure for carousel images:
[
  {
    componentName: 'car-interior-carousel',
    componentType: 'carousel',
    media: {
      desktop: 'https://...interior-banner.jpg',
      mobile: 'https://...interior-banner-mobile.jpg'
    },
    useSameMediaForAllDevices: false
  },
  {
    componentName: 'car-exterior-carousel', 
    componentType: 'carousel',
    media: {
      desktop: 'https://...exterior-banner.jpg',
      mobile: 'https://...exterior-banner-mobile.jpg'
    },
    useSameMediaForAllDevices: false
  }
]
*/
