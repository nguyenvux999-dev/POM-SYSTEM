/**
 * Middleware bảo vệ route: mọi request (trừ /login, route auth và asset tĩnh)
 * đều yêu cầu đã đăng nhập; chưa đăng nhập -> redirect /login.
 *
 * Logic cho phép/chặn nằm trong callback `authorized` (lib/auth/config.ts).
 */
export { auth as middleware } from "@/lib/auth/config";

export const config = {
  /**
   * Bỏ qua: route auth nội bộ, static của Next, favicon và mọi file có đuôi
   * (ảnh, css, js...). Còn lại đều đi qua middleware.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
