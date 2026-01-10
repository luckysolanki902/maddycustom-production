/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'd26w01jhwuuxpo.cloudfront.net',
            pathname: '/**'
          },
          {
            protocol: 'https',
            hostname: 'd3efr8i3xj2spn.cloudfront.net',
            pathname: '/**'
          },
        ],
        // Fallback domains array if older next/image config style is needed elsewhere
        domains: ['d26w01jhwuuxpo.cloudfront.net','d3efr8i3xj2spn.cloudfront.net'],
        
        // === COST OPTIMIZATION SETTINGS ===
        // Use only webp (removes avif to cut transformations in half)
        formats: ['image/webp'],
        
        // Reduce device sizes to minimize transformation variants
        // Default: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
        deviceSizes: [640, 828, 1200, 1920],
        
        // Reduce image sizes for responsive images
        // Default: [16, 32, 48, 64, 96, 128, 256, 384]
        imageSizes: [64, 128, 256],
        
        // 1 year cache TTL (reduces cache writes significantly)
        minimumCacheTTL: 31536000,
        
        // Lower default quality (reduces transformation time and cache size)
        // Default is 75, 70 is still good quality with less processing
        // qualities: [70], // Uncomment if on Next.js 15+
      },
    
    // Enable compression
    compress: true,
    
    // Reduce function bundle sizes
    experimental: {
      // Optimize server components
      optimizePackageImports: ['@mui/material', '@mui/icons-material', 'swiper', 'framer-motion'],
    },
    
    // Headers for caching static assets at CDN
    async headers() {
      return [
        {
          // Cache all static assets for 1 year
          source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|mp4|webm)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          // Cache JS and CSS for 1 year (they have hashed filenames)
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          // API routes - cache where possible
          source: '/api/showcase/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          ],
        },
        {
          // Search categories - cache for 1 hour
          source: '/api/search/search-categories',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          ],
        },
      ];
    },
};

export default nextConfig;
