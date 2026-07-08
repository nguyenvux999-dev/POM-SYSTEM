import Link from "next/link";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { maSanPhamRepository } from "@/lib/repositories/maSanPham";
import { DON_HANG_TRANG_THAI, type DonHangTrangThai } from "@/lib/domain/enums";
import type { LenhSanXuat, MaSanPham } from "@/lib/domain/types";
import { NHAN_DON_HANG_TRANG_THAI } from "@/lib/domain/labels";
import { BadgeDonHang, BadgeLenh } from "@/components/status-badge";
import { MaLenhHienThi } from "@/components/lenh-specs";

export const dynamic = "force-dynamic";

/**
 * Ô "Mã sản phẩm" của một đơn: 0 mã → "—"; 1 mã → hiện mã; nhiều mã → mã đầu
 * + "+N mã", title (hover) liệt kê đầy đủ. Dòng không có mã thì dùng tên thay.
 */
function MaSanPhamCell({ ds }: { ds: MaSanPham[] }) {
  const nhan = ds
    .map((m) => m.MaSanPham || m.TenSanPham)
    .filter((s) => s.trim() !== "");
  if (nhan.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <span className="font-mono text-xs" title={nhan.join(", ")}>
      {nhan[0]}
      {nhan.length > 1 && (
        <span className="ml-1 font-sans text-gray-400">
          +{nhan.length - 1} mã
        </span>
      )}
    </span>
  );
}

function parseTrangThai(v: string | undefined): DonHangTrangThai | undefined {
  return v && (DON_HANG_TRANG_THAI as readonly string[]).includes(v)
    ? (v as DonHangTrangThai)
    : undefined;
}

export default async function DonHangListPage({
  searchParams,
}: {
  searchParams: Promise<{
    trangThai?: string;
    khachHang?: string;
    lsx?: string;
  }>;
}) {
  const sp = await searchParams;
  const trangThai = parseTrangThai(sp.trangThai);
  const khachHang = sp.khachHang?.trim() || undefined;
  const lsx = sp.lsx?.trim() || undefined;
  const [donRows, lenhAll, maSanPhamAll] = await Promise.all([
    donHangRepository.filter({ trangThai, khachHang }),
    lenhSanXuatRepository.findAll(),
    maSanPhamRepository.findAll(),
  ]);
  // Mô hình 1–1: mỗi đơn có 0/1 lệnh → map MaDon → lệnh để hiện nhanh trên danh sách.
  const lenhByDon = new Map<string, LenhSanXuat>();
  for (const l of lenhAll) lenhByDon.set(l.MaDon, l);
  // Join MaSanPham theo MaLenh trong RAM (đọc cả tab 1 lần qua cache, không gọi theo dòng).
  const maSPByLenh = new Map<string, MaSanPham[]>();
  for (const m of maSanPhamAll) {
    const arr = maSPByLenh.get(m.MaLenh) ?? [];
    arr.push(m);
    maSPByLenh.set(m.MaLenh, arr);
  }

  // Lọc theo mã Lệnh (LSX): khớp MaLSXXuong HOẶC MaLenh (chứa, không phân biệt hoa thường).
  const rows = lsx
    ? donRows.filter((d) => {
        const l = lenhByDon.get(d.MaDon);
        if (!l) return false;
        const kho = `${l.MaLSXXuong ?? ""} ${l.MaLenh}`.toLowerCase();
        return kho.includes(lsx.toLowerCase());
      })
    : donRows;

  return (
    // Khung trang: tiêu đề + bộ lọc cố định, chỉ vùng bảng cuộn (min-h-0 bắt buộc).
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
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
        className="flex shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-end"
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
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Lệnh (LSX)</label>
          <input
            name="lsx"
            defaultValue={lsx ?? ""}
            placeholder="Mã LSX xưởng hoặc mã hệ thống"
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

      <div className="min-h-0 overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Mã đơn</th>
              <th className="px-3 py-2">Ngày nhận</th>
              <th className="px-3 py-2">Khách hàng</th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Mã sản phẩm</th>
              <th className="px-3 py-2">SL</th>
              <th className="px-3 py-2">Giao hàng</th>
              <th className="px-3 py-2">Lệnh (LSX)</th>
              <th className="px-3 py-2">TT lệnh</th>
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
                <td className="px-3 py-2">
                  <MaSanPhamCell
                    ds={
                      lenhByDon.has(d.MaDon)
                        ? (maSPByLenh.get(lenhByDon.get(d.MaDon)!.MaLenh) ?? [])
                        : []
                    }
                  />
                </td>
                <td className="px-3 py-2">{d.SoLuong.toLocaleString()}</td>
                <td className="px-3 py-2">{d.NgayGiaoHang}</td>
                <td className="px-3 py-2">
                  {lenhByDon.has(d.MaDon) ? (
                    <MaLenhHienThi
                      maLenh={lenhByDon.get(d.MaDon)!.MaLenh}
                      maLSXXuong={lenhByDon.get(d.MaDon)!.MaLSXXuong}
                      size="xs"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Chưa có lệnh</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {lenhByDon.has(d.MaDon) ? (
                    <BadgeLenh value={lenhByDon.get(d.MaDon)!.TrangThai} />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <BadgeDonHang value={d.TrangThai} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-gray-400"
                >
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
