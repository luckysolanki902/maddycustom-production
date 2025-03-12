export default function robots() {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/api/',  
            '/order/myorders/',
            '/error',
            '/not-found',
            '/bike/'
          ],
        },
      ],
      sitemap: [
        'https://www.maddycustom.com/sitemap.xml',
        'https://www.maddycustom.com/seo/sitemaps/video-sitemap.xml',
        'https://www.maddycustom.com/seo/sitemaps/image-sitemap.xml',
      ],
    };
  }
  