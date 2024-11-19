export default function robots() {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/api/',  
            '/order/myorders/',
            'bike/'
          ],
        },
      ],
      sitemap: [
        'https://maddycustom.com/sitemap.xml',
        'https://maddycustom.com/seo/sitemaps/video-sitemap.xml',
        'https://maddycustom.com/seo/sitemaps/image-sitemap.xml',
      ],
    };
  }
  