import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keeps the dev badge out of screenshots from npm run shots.
  devIndicators: false,
};

export default nextConfig;
