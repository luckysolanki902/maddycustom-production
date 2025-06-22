/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'd26w01jhwuuxpo.cloudfront.net',
          },
          {
            protocol: 'https',
            hostname: 'd3efr8i3xj2spn.cloudfront.net',
          },
        ],
      },

};

export default nextConfig;
