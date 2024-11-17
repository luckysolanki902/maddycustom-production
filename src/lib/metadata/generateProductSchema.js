// @/lib/metadata/generateProductSchema.js
import { mainDescription } from "../constants/seoConsts";

// For product pages
export function generateProductSchema({ product, currency = 'INR' }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      image: product.images.map((img) => `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${img}`),
      description: product.description,
      sku: product.sku,
      brand: {
        '@type': 'Brand',
        name: 'Maddy Custom',
      },
      offers: {
        '@type': 'Offer',
        url: product.url,
        priceCurrency: currency,
        price: product.price,
        itemCondition: 'https://schema.org/NewCondition',
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
    };
  }
  


  // For layout.js
  export function generateWebsiteSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Maddy Custom',
      url: 'https://maddycustom.com',
      description: mainDescription,
      publisher: {
        '@type': 'Organization',
        name: 'Maddy Custom',
        logo: {
          '@type': 'ImageObject',
          url: `/images/metadata/500500.png`,
        },
      },
    };
}

  
  export function generateOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Maddy Custom',
      url: 'https://maddycustom.com',
      logo: `/images/metadata/500500.png`,
      description: mainDescription,
      sameAs: [
        // 'https://www.facebook.com/maddycustom',
        'https://www.instagram.com/maddycustom',
        // 'https://www.twitter.com/maddycustom',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-8112673988',
        contactType: 'Founder',
      },
    };
  }
  