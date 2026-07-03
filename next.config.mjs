/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // googleapis chỉ chạy ở server; đánh dấu external để không bị bundle vào client.
  serverExternalPackages: ["googleapis", "google-auth-library"],
};

export default nextConfig;
