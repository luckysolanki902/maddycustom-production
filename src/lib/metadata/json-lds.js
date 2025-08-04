// @/lib/metadata/json-lds.js
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
        name: 'MaddyCustom',
      },
      manufacturer: {
        '@type': 'Organization',
        name: 'MaddyCustom',
      },
      offers: {
        '@type': 'Offer',
        url: product.url,
        priceCurrency: currency,
        price: product.price,
        itemCondition: 'https://schema.org/NewCondition',
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'MaddyCustom',
        },
      },
      category: 'Vehicle Accessories',
    };
  }
  


  // For layout.js
  export function generateWebsiteSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'MaddyCustom',
      alternateName: 'Maddy Custom',
      url: 'https://www.maddycustom.com',
      description: mainDescription,
      publisher: {
        '@type': 'Organization',
        name: 'MaddyCustom',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.maddycustom.com/images/metadata/500500.png',
        },
      },
      // potentialAction: {
      //   '@type': 'SearchAction',
      //   target: 'https://www.maddycustom.com/shop?search={search_term_string}',
      //   'query-input': 'required name=search_term_string',
      // },
    };
}

  
  export function generateOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'MaddyCustom',
      alternateName: 'Maddy Custom',
      url: 'https://www.maddycustom.com',
      logo: 'https://www.maddycustom.com/images/metadata/500500.png',
      description: mainDescription,
      foundingDate: '2020',
      founder: {
        '@type': 'Person',
        name: 'Harshit Yadav',
      },
      areaServed: {
        '@type': 'Country',
        name: 'India',
      },
      serviceType: [
        'Vehicle Customization',
        'Car Wraps',
        'Bike Wraps',
        'Vehicle Accessories',
        'Car Accessories',
        'Bike Accessories'
      ],
      sameAs: [
        'https://www.instagram.com/maddycustom',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-8112673988',
        contactType: 'Customer Service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    };
  }
  