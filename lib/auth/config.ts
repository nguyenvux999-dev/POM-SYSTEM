/**
 * Cấu hình Auth.js (NextAuth v5) — Google OAuth + allowlist email.
 *
 * - Chỉ email nằm trong ALLOWED_EMAILS mới được phép đăng nhập.
 * - Env được đọc LƯỜI (dạng hàm) để `npm run build` không đòi hỏi secret thật.
 * - `authorized` callback dùng cho middleware bảo vệ route.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getAllowedEmails, getAuthEnv } from "@/lib/env";

/** Các đường dẫn công khai (không yêu cầu đăng nhập). */
const PUBLIC_PATHS = ["/login"];

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const { secret, googleId, googleSecret } = getAuthEnv();

  return {
    secret,
    trustHost: true,
    providers: [
      Google({
        clientId: googleId,
        clientSecret: googleSecret,
      }),
    ],
    pages: {
      signIn: "/login",
      error: "/login", // email ngoài allowlist -> quay lại /login kèm ?error
    },
    callbacks: {
      /** Chặn đăng nhập nếu email không nằm trong allowlist. */
      signIn({ user, profile }) {
        const email = (profile?.email ?? user?.email ?? "").toLowerCase();
        if (!email) return false;
        return getAllowedEmails().includes(email);
      },

      /** Middleware gọi callback này để quyết định cho vào route hay không. */
      authorized({ auth: session, request }) {
        const { pathname } = request.nextUrl;
        const isPublic = PUBLIC_PATHS.some(
          (p) => pathname === p || pathname.startsWith(`${p}/`),
        );
        if (isPublic) return true;
        return !!session?.user;
      },
    },
  };
});
