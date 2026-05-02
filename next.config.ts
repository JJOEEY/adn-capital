import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "**.vnecdn.net" },
      { protocol: "https", hostname: "**.vnexpress.net" },
      { protocol: "https", hostname: "**.cafef.vn" },
      { protocol: "https", hostname: "**.mediacdn.vn" },
      { protocol: "https", hostname: "**.cafefcdn.com" },
      { protocol: "https", hostname: "**.tuoitre.vn" },
      { protocol: "https", hostname: "**.thanhnien.vn" },
      { protocol: "https", hostname: "**.tinnhanhchungkhoan.vn" },
      { protocol: "https", hostname: "**.nld.com.vn" },
      { protocol: "https", hostname: "**.dantri.com.vn" },
      { protocol: "https", hostname: "**.vietnamnet.vn" },
      { protocol: "https", hostname: "**.vietstock.vn" },
      { protocol: "https", hostname: "**.vneconomy.vn" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/tei",
        destination: "/art",
        permanent: true,
      },
      {
        source: "/tei/:path*",
        destination: "/art/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
