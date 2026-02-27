/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Preview-only deployment: do not block build on type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Preview-only deployment: do not block build on lint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

module.exports = nextConfig;
