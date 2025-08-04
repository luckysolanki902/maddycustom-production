export default function robots() {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/api/',  
            '/order/myorders/',
            '/user/',
            '/my-garage/',
            '/viewcart/',
            '/error',
            '/not-found',
            '/test/',
            '/private/',
            '/*?*utm_*',
            '/*?*session*',
            '/*?*sid=*',
          ],
        },
        {
          userAgent: 'Googlebot',
          allow: '/',
          disallow: [
            '/api/',  
            '/order/myorders/',
            '/user/',
            '/my-garage/',
            '/viewcart/',
            '/private/',
          ],
        },
      ],
      sitemap: [
        'https://www.maddycustom.com/sitemap.xml',
        'https://www.maddycustom.com/seo/sitemaps/video-sitemap.xml',
        'https://www.maddycustom.com/seo/sitemaps/image-sitemap.xml',
      ],
      host: 'https://www.maddycustom.com',
    };
  }
  