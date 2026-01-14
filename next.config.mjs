/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Keep optimization enabled but cache for 10 years to avoid repeated transformations
        minimumCacheTTL: 315360000, // 10 years in seconds
        deviceSizes: [640, 828, 1200, 1920], // Reduced from 6 to 4 sizes (33% fewer transformations)
        imageSizes: [16, 32, 64, 128, 256], // Reduced from 8 to 5 sizes (37% fewer transformations)
        formats: ['image/webp'], // Only WebP for better compression
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        
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
        domains: ['d26w01jhwuuxpo.cloudfront.net','d3efr8i3xj2spn.cloudfront.net']
      },

    // Optimize compilation and reduce bundle size
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },


};

export default nextConfig;
