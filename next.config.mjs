/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // Service worker harus selalu di-revalidate agar update cepat diterapkan
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
