import Link from "next/link";
import { donHangRepository } from "@/lib/repositories/donHang";
import {
  DON_HANG_TRANG_THAI,
  type DonHangTrangThai,
} from "@/lib/domain/enums";
import { NHAN_DON_HANG_TRANG_THAI } from "@/lib/domain/labels";
import { BadgeDonHang } from "@/components/status-badge";

export const dynamic = "force-dynamic";

function parseTrangThai(v: string | undefined): DonHangTrangThai | undefined {
  return v && (DON_HANG_TRANG_THAI as readonly string[]).includes(v)
    ? (v as DonHangTrangThai)
    : undefined;
}

export default async function DonHangListPage({
  searchParams,
}: {
  searchParams: Promise<{ trangThai?: string; khachHang?: string }>;
}) {
  const sp = await searchParams;
  const trangThai = parseTrangThai(sp.trangThai);
  const khachHang = sp.khachHang?.trim() || undefined;
  const rows = await donHangRepository.filter({ trangThai, khachHang });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Đơn hàng</h1>
        <Link
          href="/don-hang/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          ＋ Tạo đơn
        </Link>
      </div>

      {/* Filter (GET) */}
      <form
        method="get"
        className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Trạng thái</label>
          <select
            name="trangThai"
            defaultValue={trangThai ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả</option>
            {DON_HANG_TRANG_THAI.map((t) => (
              <option key={t} value={t}>
                {NHAN_DON_HANG_TRANG_THAI[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Khách hàng</label>
          <input
            name="khachHang"
            defaultValue={khachHang ?? ""}
            placeholder="Tìm theo tên khách"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Lọc
          </button>
          <Link
            href="/don-hang"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Xóa lọc
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Mã đơn</th>
              <th className="px-3 py-2">Ngày nhận</th>
              <th className="px-3 py-2">Khách hàng</th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">SL</th>
              <th className="px-3 py-2">Giao hàng</th>
              <th className="px-3 py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((d) => (
              <tr key={d.MaDon} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">
                  <Link
                    href={`/don-hang/${d.MaDon}`}
                    className="text-brand hover:underline"
                  >
                    {d.MaDon}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.NgayNhan}</td>
                <td className="px-3 py-2">{d.KhachHang}</td>
                <td className="px-3 py-2">{d.TenSanPham}</td>
                <td className="px-3 py-2">{d.SoLuong.toLocaleString()}</td>
                <td className="px-3 py-2">{d.NgayGiaoHang}</td>
                <td className="px-3 py-2">
                  <BadgeDonHang value={d.TrangThai} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Không có đơn hàng nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
