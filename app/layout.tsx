import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/lib/auth/config";
import { NavBar } from "@/components/nav/nav-bar";

export const metadata: Metadata = {
  title: "Quản lý Lệnh Sản xuất",
  description: "Hệ thống sắp xếp lệnh sản xuất cho xưởng in offset",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve session một lần ở layout. Thanh điều hướng chỉ hiện khi đã đăng nhập
  // (trang /login không có session -> không hiện nav).
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? null;

  return (
    <html lang="vi">
      <body className="min-h-full">
        {userName && <NavBar userName={userName} />}
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
