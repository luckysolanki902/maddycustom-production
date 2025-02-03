/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'd3efr8i3xj2spn.cloudfront.net',
          },
        ],
      },

};

export default nextConfig;
