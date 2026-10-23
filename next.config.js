/** @type {import('next').NextConfig} */
// Mitigation GHSA-2464-fhr4-w9xw / GHSA-2xp9-vwfh-vxw4 (no fix on Next 14): /_next/image answers 404; originals served directly.
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
