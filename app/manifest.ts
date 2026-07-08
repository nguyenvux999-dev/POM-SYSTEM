/**
 * Web App Manifest — Next tự phục vụ tại /manifest.webmanifest.
 *
 * Icon nằm trong /public/icons (sinh bằng `npm run icons`, xem README).
 * Không khai báo offline/cache ở đây — app phụ thuộc Google Sheets realtime.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lệnh Sản Xuất",
    short_name: "Lệnh SX",
    description: "Hệ thống quản lý & sắp xếp lệnh sản xuất",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#1F3A6E",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
