/**
 * Service Worker tối thiểu — chỉ để app cài được lên màn hình chính.
 *
 * Nguyên tắc chống "kẹt bản cũ":
 * - KHÔNG precache app-shell, KHÔNG cache HTML/API/dữ liệu Google Sheets.
 * - Chỉ cache tài nguyên tĩnh có hash trong tên file (/_next/static/*) và
 *   icon (/icons/*) — các file này bất biến theo tên nên cache-first an toàn.
 * - skipWaiting + clients.claim + xóa cache cũ: bản SW mới nắm quyền ngay.
 *
 * Khi đổi logic SW, tăng version trong CACHE_NAME để dọn cache cũ.
 */
const CACHE_NAME = "lsx-static-v1";

self.addEventListener("install", () => {
  // Kích hoạt bản mới ngay, không chờ người dùng đóng hết tab.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Xóa mọi cache cũ khác tên cache hiện tại.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      // Nắm quyền điều khiển các tab đang mở ngay lập tức.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Không phải GET (POST server action, mutation...) -> network-only.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Request ra ngoài origin (Google APIs...) -> không đụng vào.
  if (url.origin !== self.location.origin) return;

  // API, route auth, manifest -> network-only (tuyệt đối không cache dữ liệu động).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return;
  }

  // Điều hướng trang (HTML) -> network-first. Vì cố ý KHÔNG cache HTML
  // (nguồn gốc của kẹt bản cũ) nên không có fallback: luôn lấy bản mới từ mạng.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  // Tài nguyên tĩnh có hash trong tên + icon -> cache-first an toàn.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Còn lại (ảnh động, /_next/image...) -> để trình duyệt xử lý mặc định.
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
