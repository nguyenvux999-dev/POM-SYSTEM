/**
 * Thanh điều hướng: hiển thị liên kết tới các khu vực nghiệp vụ, tên người
 * đăng nhập và nút đăng xuất. Mobile-first: cuộn ngang trên màn hình hẹp.
 *
 * Nhận `userName` từ layout (layout đã resolve session một lần) để tránh gọi
 * auth() nhiều lần trong một request.
 */
import Link from "next/link";
import { signOut } from "@/lib/auth/config";
import { NAV_ITEMS } from "./nav-items";

export function NavBar({ userName }: { userName: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-base font-semibold text-brand">
            🏭 Lệnh Sản Xuất
          </Link>
          {userName && (
            <div className="flex items-center gap-2 sm:hidden">
              <span className="max-w-[9rem] truncate text-xs text-gray-500">
                {userName}
              </span>
              <SignOutButton />
            </div>
          )}
        </div>

        <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-1 whitespace-nowrap">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {userName && (
          <div className="hidden items-center gap-3 sm:flex">
            <span className="max-w-[12rem] truncate text-xs text-gray-500">
              {userName}
            </span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}

/** Nút đăng xuất — dùng server action, không cần client component riêng. */
function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
      >
        Đăng xuất
      </button>
    </form>
  );
}
