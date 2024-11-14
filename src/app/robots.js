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
        'https://maddycustom.com/api/seo/image-sitemap',
        'https://maddycustom.com/api/seo/video-sitemap',
      ],
    };
  }
  