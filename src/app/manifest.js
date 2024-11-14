export default function manifest() {
    return {
      name: 'Maddy Custom',
      short_name: 'Maddy Custom',
      description: 'Discover Maddy Custom’s unique vehicle wraps and helmet graphics for unmatched durability and style.',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      icons: [
        {
          src: '/images/metadata/favicon.ico',
          sizes: '32x32',
          type: 'image/x-icon',
        },
        {
          src: '/images/metadata/500500.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/images/metadata/500500.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    };
  }
  