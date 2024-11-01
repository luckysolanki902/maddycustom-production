/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'd26w01jhwuuxpo.cloudfront.net',
          },
          {
            protocol: 'https',
            hostname: "d26w01jhwuuxpo.cloudfront.netundefined",
          },
        ],
      },

};

export default nextConfig;
