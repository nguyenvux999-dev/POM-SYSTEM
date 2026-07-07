/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // googleapis chỉ chạy ở server; đánh dấu external để không bị bundle vào client.
  serverExternalPackages: ["googleapis", "google-auth-library"],
  // Ảnh thư viện sản phẩm lưu trên Vercel Blob (public store) — cho next/image tối ưu.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    // Server Action mặc định giới hạn body 1 MB — nâng lên 5 MB để nhận ảnh
    // thư viện SP (giới hạn nghiệp vụ 4 MB validate ở cả client lẫn server).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
