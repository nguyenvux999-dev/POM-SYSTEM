import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth/config";

/**
 * Trang đăng nhập. Nút "Đăng nhập với Google" gọi server action signIn.
 * Nếu email không nằm trong allowlist, Auth.js sẽ chuyển về đây kèm ?error.
 *
 * Trang này chỉ dành cho người CHƯA đăng nhập: đã có session mà vào /login
 * (bookmark, nút back, PWA khôi phục tab...) -> redirect về trang đích ngay.
 * Đăng nhập xong quay lại đúng trang người dùng định mở (?callbackUrl do
 * middleware gắn khi đá về login); chỉ chấp nhận đường dẫn nội bộ.
 */

/** Chỉ nhận đường dẫn nội bộ ("/..."), chặn open-redirect ("//..." hay URL ngoài). */
function sanitizeCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/";
  try {
    // callbackUrl có thể là URL tuyệt đối cùng origin (middleware gắn dạng này).
    const url = new URL(raw, "http://placeholder.local");
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return url.pathname + url.search || "/";
  } catch {
    return "/";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const redirectTo = sanitizeCallbackUrl(callbackUrl);

  // Đã đăng nhập -> không có việc gì ở trang login, về thẳng trang đích.
  const session = await auth();
  if (session?.user) redirect(redirectTo);

  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center overflow-y-auto text-center">
      <div className="w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-4xl">🏭</div>
        <h1 className="mt-3 text-lg font-semibold">Quản lý Lệnh Sản xuất</h1>
        <p className="mt-1 text-sm text-gray-500">
          Đăng nhập để tiếp tục. Chỉ tài khoản trong danh sách cho phép mới truy
          cập được.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Tài khoản này không có quyền truy cập. Liên hệ quản trị để được thêm
            vào danh sách cho phép.
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-white transition hover:bg-brand-dark"
          >
            Đăng nhập với Google
          </button>
        </form>
      </div>
    </div>
  );
}
