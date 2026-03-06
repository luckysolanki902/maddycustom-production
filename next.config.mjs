/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true,
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'd26w01jhwuuxpo.cloudfront.net',
            pathname: '/**'
          },
        ],
      },

    // Optimize compilation and reduce bundle size
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },


};

export default nextConfig;
