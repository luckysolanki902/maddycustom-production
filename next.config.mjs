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
        domains: ['d26w01jhwuuxpo.cloudfront.net','d3efr8i3xj2spn.cloudfront.net']
      },

};

export default nextConfig;
