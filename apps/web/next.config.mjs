/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@age/ui', '@age/sdk', '@age/types'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
