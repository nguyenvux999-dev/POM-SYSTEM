import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/lib/auth/config";
import { NavBar } from "@/components/nav/nav-bar";
import { PwaSetup } from "@/components/pwa/pwa-setup";

export const metadata: Metadata = {
  title: "Quản lý Lệnh Sản xuất",
  description: "Hệ thống sắp xếp lệnh sản xuất cho xưởng in offset",
  // PWA trên iOS: chạy toàn màn hình khi thêm vào màn hình chính.
  appleWebApp: {
    capable: true,
    title: "Lệnh SX",
    statusBarStyle: "default",
  },
  other: {
    // appleWebApp.capable ở trên chỉ sinh thẻ mobile-web-app-capable (chuẩn
    // mới); thêm thẻ apple-* cũ cho iOS Safari đời trước.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3A6E",
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
      {/* Khung 100dvh: nav cố định trên đỉnh, main chiếm phần còn lại; cả trang
          KHÔNG cuộn — chỉ vùng dữ liệu bên trong từng trang cuộn (min-h-0 để
          overflow-y-auto của con hoạt động trong flexbox). */}
      <body className="app-shell flex flex-col overflow-hidden">
        {userName && <NavBar userName={userName} />}
        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto h-full min-h-0 w-full max-w-5xl px-4 py-4">
            {children}
          </div>
        </main>
        {/* Đăng ký service worker + nút cài PWA (client, không chặn render) */}
        <PwaSetup />
      </body>
    </html>
  );
}
