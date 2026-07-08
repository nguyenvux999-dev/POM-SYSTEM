import Link from "next/link";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { mayRepository } from "@/lib/repositories/may";
import { baoCaoNgay } from "@/lib/domain/report";
import { nowLocal, todayVN } from "@/lib/domain/datetime";
import { NHAN_CONG_DOAN, NHAN_PHAT_SINH_LOAI } from "@/lib/domain/labels";
import { DateRange } from "@/components/date-range";
import { ExportButtons } from "@/components/export-button";
import type { CongDoan } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";

export default async function BaoCaoNgayPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const homNay = todayVN();
  const ngay = from ?? homNay;

  const [lenhs, dons, lichAll, tienDoAll, phatSinhAll, mayList] =
    await Promise.all([
      lenhSanXuatRepository.findAll(),
      donHangRepository.findAll(),
      lichChayRepository.findAll(),
      tienDoRepository.findAll(),
      phatSinhRepository.findAll(),
      mayRepository.findAll(),
    ]);

  const bc = baoCaoNgay({
    ngay,
    lenhs,
    dons,
    lichAll,
    tienDoAll,
    phatSinhAll,
    mayList,
    now: nowLocal(),
    homNay,
  });

  const lyDoText = (n: (typeof bc.nguyCoTre)[number]): string => {
    const parts: string[] = [];
    if (n.boiMay) parts.push("máy hỏng/bảo trì");
    if (n.boiLich) parts.push("lịch vượt hạn");
    for (const p of n.phatSinhMo) parts.push(NHAN_PHAT_SINH_LOAI[p.Loai]);
    return parts.join("; ") || "—";
  };

  const excelSheets = [
    {
      name: "Đã xong",
      rows: bc.daXongLenh.map((l) => ({
        MaLenh: l.MaLenh,
        SanPham: l.TenSanPham,
        KhachHang: l.KhachHang,
        ThoiDiem: l.thoiDiem,
      })),
    },
    {
      name: "Đang chạy",
      rows: bc.dangChay.map((l) => ({
        MaLenh: l.MaLenh,
        SanPham: l.TenSanPham,
        KhachHang: l.KhachHang,
        CongDoan: l.congDoanHienTai
          ? NHAN_CONG_DOAN[l.congDoanHienTai as CongDoan]
          : "",
        Han: l.HanHoanThanh,
      })),
    },
    {
      name: "Nguy cơ trễ",
      rows: bc.nguyCoTre.map((n) => ({
        MaLenh: n.MaLenh,
        SanPham: n.TenSanPham,
        KhachHang: n.KhachHang,
        Han: n.HanHoanThanh,
        DuKienXong: n.ketThucDuKien,
        LyDo: lyDoText(n),
      })),
    },
  ];

  return (
    // Tiêu đề + chọn ngày cố định; ba cột số liệu nằm trong vùng cuộn.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/bao-cao" className="text-sm text-brand hover:underline">
            ← Báo cáo
          </Link>
          <h1 className="text-xl font-semibold">Báo cáo ngày {ngay}</h1>
        </div>
        <ExportButtons
          fileName={`bao-cao-ngay-${ngay}.xlsx`}
          sheets={excelSheets}
        />
      </div>

      <div className="shrink-0">
        <DateRange from={ngay} to={ngay} homNay={homNay} mode="day" />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-3">
        {/* Đã xong */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-green-700">
            ✓ Đã xong trong ngày ({bc.daXongLenh.length} lệnh · {bc.soDonXong}{" "}
            đơn)
          </h2>
          <div className="space-y-2">
            {bc.daXongLenh.map((l) => (
              <div
                key={l.MaLenh}
                className="rounded-md border border-gray-100 p-2 text-sm"
              >
                <div className="font-mono text-xs">{l.MaLenh}</div>
                <div className="font-medium">{l.TenSanPham || "—"}</div>
                <div className="text-xs text-gray-500">
                  {l.KhachHang} · {l.thoiDiem.slice(11, 16)}
                </div>
              </div>
            ))}
            {bc.daXongLenh.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">
                (chưa có)
              </p>
            )}
          </div>
        </section>

        {/* Đang chạy */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-blue-700">
            ▶ Đang chạy ({bc.dangChay.length})
          </h2>
          <div className="space-y-2">
            {bc.dangChay.map((l) => (
              <div
                key={l.MaLenh}
                className="rounded-md border border-gray-100 p-2 text-sm"
              >
                <div className="font-mono text-xs">{l.MaLenh}</div>
                <div className="font-medium">{l.TenSanPham || "—"}</div>
                <div className="text-xs text-gray-500">
                  {l.congDoanHienTai
                    ? NHAN_CONG_DOAN[l.congDoanHienTai as CongDoan]
                    : "—"}{" "}
                  · Hạn {l.HanHoanThanh || "—"}
                </div>
              </div>
            ))}
            {bc.dangChay.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">
                (chưa có)
              </p>
            )}
          </div>
        </section>

        {/* Nguy cơ trễ */}
        <section className="rounded-lg border border-red-200 bg-red-50/40 p-3">
          <h2 className="mb-2 text-sm font-semibold text-red-700">
            ⚠️ Nguy cơ trễ ({bc.nguyCoTre.length})
          </h2>
          <div className="space-y-2">
            {bc.nguyCoTre.map((n) => (
              <div
                key={n.MaLenh}
                className="rounded-md border border-red-100 bg-white p-2 text-sm"
              >
                <div className="font-mono text-xs">{n.MaLenh}</div>
                <div className="font-medium">{n.TenSanPham || "—"}</div>
                <div className="text-xs text-gray-500">
                  {n.KhachHang} · Hạn {n.HanHoanThanh || "—"}
                  {n.ketThucDuKien &&
                    ` · dự kiến ${n.ketThucDuKien.slice(0, 10)}`}
                </div>
                <div className="mt-1 text-xs font-medium text-red-600">
                  Lý do: {lyDoText(n)}
                </div>
              </div>
            ))}
            {bc.nguyCoTre.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">
                (không có)
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
