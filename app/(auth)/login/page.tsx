import { signIn } from "@/lib/auth/config";

/**
 * Trang đăng nhập. Nút "Đăng nhập với Google" gọi server action signIn.
 * Nếu email không nằm trong allowlist, Auth.js sẽ chuyển về đây kèm ?error.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center text-center">
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
            await signIn("google", { redirectTo: "/" });
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
