export default async function sitemap() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seo/sitemap-data`);
    const { products, variants } = await response.json();
  
    const baseUrl = 'https://www.maddycustom.com';
  
    // 1. Home page - highest priority at the top
    const homeRoute = [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
    ];

    // 2. Dynamic variant pages with proper lastModified dates - sorted by latest first
    const variantRoutes = variants
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .map((variant) => ({
        url: `${baseUrl}/shop${variant.pageSlug}`,
        lastModified: new Date(variant.lastModified),
        changeFrequency: 'weekly',
        priority: 0.9,
      }));

    // 3. Other static pages - ordered by importance
    const otherStaticRoutes = [
      {
        url: `${baseUrl}/shop`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.85,
      },
      {
        url: `${baseUrl}/orders/track`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/about-us`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/contact-us`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${baseUrl}/faqs`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      {
        url: `${baseUrl}/termsandconditions`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.4,
      },
    ];
  
    // 4. Dynamic product pages with proper lastModified dates - sorted by latest first
    const productRoutes = products
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .map((product) => ({
        url: `${baseUrl}/shop${product.pageSlug}`,
        lastModified: new Date(product.lastModified),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
  
    // Return in the specified order: home > variant routes > other static routes > product routes
    return [...homeRoute, ...variantRoutes, ...otherStaticRoutes, ...productRoutes];
  }
  