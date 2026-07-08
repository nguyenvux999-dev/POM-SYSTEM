import Link from "next/link";
import { NAV_ITEMS } from "@/components/nav/nav-items";
import { mayRepository } from "@/lib/repositories/may";
import type { May } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** Trang chủ: lối tắt tới 6 khu vực nghiệp vụ và kiểm tra kết nối dữ liệu. */
export default async function HomePage() {
  let may: May[] | null = null;
  let error: string | null = null;
  try {
    may = await mayRepository.findAll();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="h-full space-y-8 overflow-y-auto">
      <section>
        <h1 className="text-xl font-semibold">Trang điều hành</h1>
        <p className="mt-1 text-sm text-gray-500">Chọn khu vực để bắt đầu.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-brand hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">
          Kiểm tra kết nối dữ liệu
        </h2>

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">Chưa đọc được dữ liệu.</p>
            <p className="mt-1 whitespace-pre-wrap font-mono text-xs">
              {error}
            </p>
            <p className="mt-2 text-xs text-red-600">
              Vui lòng liên hệ quản trị hệ thống.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-green-50 px-4 py-2 text-sm text-green-700">
              ✅ Kết nối OK — đọc được <strong>{may?.length ?? 0}</strong> máy.
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên máy</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Khổ tối đa</th>
                  <th className="px-3 py-2">NS (tờ/giờ)</th>
                  <th className="px-3 py-2">Make-ready (phút)</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(may ?? []).map((m) => (
                  <tr key={m.MaMay}>
                    <td className="px-3 py-2 font-mono">{m.MaMay}</td>
                    <td className="px-3 py-2">{m.TenMay}</td>
                    <td className="px-3 py-2">{m.Loai}</td>
                    <td className="px-3 py-2">{m.KhoToiDa}</td>
                    <td className="px-3 py-2">{m.NangSuat.toLocaleString()}</td>
                    <td className="px-3 py-2">{m.ThoiGianMakeReady}</td>
                    <td className="px-3 py-2">{m.TrangThai}</td>
                  </tr>
                ))}
                {(may ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-gray-400"
                    >
                      Tab May chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
