/**
 * Middleware bảo vệ route: mọi request (trừ /login, route auth và asset tĩnh)
 * đều yêu cầu đã đăng nhập; chưa đăng nhập -> redirect /login.
 *
 * Logic cho phép/chặn nằm trong callback `authorized` (lib/auth/config.ts).
 */
export { auth as middleware } from "@/lib/auth/config";

export const config = {
  /**
   * Bỏ qua: route auth nội bộ, static của Next, favicon, các đường PWA
   * (sw.js, manifest, icon — nếu bị chặn thì KHÔNG cài được PWA) và mọi file
   * có đuôi (ảnh, css, js...). Còn lại đều đi qua middleware.
   *
   * Lưu ý: `.*\\.` đã loại trừ mọi path chứa dấu chấm, nhưng vẫn liệt kê
   * tường minh các đường PWA để không vô tình chặn nếu sau này sửa matcher.
   */
  matcher: [
    "/((?!api/auth|_next|favicon.ico|sw.js|manifest.webmanifest|icons/|apple-icon|icon|logo-source|.*\\.).*)",
  ],
};
