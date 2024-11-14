export default async function sitemap() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seo/sitemap-data`);
    const { products, variants } = await response.json();
  
    const baseUrl = 'https://maddycustom.com';
  
    // Core pages of your site
    const staticRoutes = [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 1,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/termsandconditions`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
    ];
  
    // Dynamic product and variant pages
    const productRoutes = products.map((product) => ({
      url: `${baseUrl}/shop${product.pageSlug}`,
      lastModified: new Date(),  // Use the current date for lastModified
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  
    const variantRoutes = variants.map((variant) => ({
      url: `${baseUrl}/shop${variant.pageSlug}`,
      lastModified: new Date(),  // Use the current date for lastModified
      changeFrequency: 'daily',
      priority: 0.9,
    }));
  
    return [...staticRoutes, ...productRoutes, ...variantRoutes];
  }
  