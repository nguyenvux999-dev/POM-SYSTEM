import Link from "next/link";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { tyLeDungHan } from "@/lib/domain/report";
import { cuoiThang, dauThang, todayVN } from "@/lib/domain/datetime";
import { DateRange } from "@/components/date-range";
import { ExportButtons } from "@/components/export-button";

export const dynamic = "force-dynamic";

export default async function DungHanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const homNay = todayVN();
  const thang = (from ?? homNay).slice(0, 7);

  const [dons, lenhs, tienDoAll] = await Promise.all([
    donHangRepository.findAll(),
    lenhSanXuatRepository.findAll(),
    tienDoRepository.findAll(),
  ]);

  const kq = tyLeDungHan({ thang, dons, lenhs, tienDoAll, homNay });

  const excelSheets = [
    {
      name: "Tong quan",
      rows: [
        { ChiTieu: "Tháng", GiaTri: thang },
        { ChiTieu: "Tổng đơn xét", GiaTri: kq.tong },
        { ChiTieu: "Đúng hạn", GiaTri: kq.dungHan },
        { ChiTieu: "Trễ", GiaTri: kq.tre },
        { ChiTieu: "Tỷ lệ đúng hạn (%)", GiaTri: kq.tyLe },
      ],
    },
    {
      name: "Don tre",
      rows: kq.danhSachTre.map((d) => ({
        MaDon: d.MaDon,
        KhachHang: d.KhachHang,
        NgayGiaoHang: d.NgayGiaoHang,
        NgayHoanThanh: d.ngayHoanThanh ?? "(chưa xong)",
        SoNgayTre: d.soNgayTre,
      })),
    },
  ];

  return (
    // Tiêu đề + chọn tháng + thẻ thống kê cố định; bảng đơn trễ là vùng cuộn.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/bao-cao" className="text-sm text-brand hover:underline">
            ← Báo cáo
          </Link>
          <h1 className="text-xl font-semibold">Tỷ lệ đúng hạn — {thang}</h1>
        </div>
        <ExportButtons
          fileName={`dung-han-${thang}.xlsx`}
          sheets={excelSheets}
        />
      </div>

      <div className="shrink-0">
        <DateRange
          from={dauThang(`${thang}-01`)}
          to={cuoiThang(`${thang}-01`)}
          homNay={homNay}
          mode="month"
        />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold">{kq.tyLe}%</div>
          <div className="text-xs text-gray-500">Đúng hạn</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold">{kq.tong}</div>
          <div className="text-xs text-gray-500">Tổng đơn xét</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-semibold text-green-700">
            {kq.dungHan}
          </div>
          <div className="text-xs text-gray-500">Đúng hạn</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-semibold text-red-700">{kq.tre}</div>
          <div className="text-xs text-gray-500">Trễ</div>
        </div>
      </div>

      <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3">
        <h2 className="mb-2 shrink-0 text-sm font-semibold text-gray-700">
          Đơn trễ ({kq.danhSachTre.length})
        </h2>
        <div className="min-h-0 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-gray-500">
              <tr>
                <th className="px-2 py-1">Đơn</th>
                <th className="px-2 py-1">Khách</th>
                <th className="px-2 py-1">Hạn giao</th>
                <th className="px-2 py-1">Hoàn thành</th>
                <th className="px-2 py-1">Số ngày trễ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kq.danhSachTre.map((d) => (
                <tr key={d.MaDon}>
                  <td className="px-2 py-1 font-mono">{d.MaDon}</td>
                  <td className="px-2 py-1">{d.KhachHang}</td>
                  <td className="px-2 py-1">{d.NgayGiaoHang}</td>
                  <td className="px-2 py-1">
                    {d.ngayHoanThanh ?? "(chưa xong)"}
                  </td>
                  <td className="px-2 py-1 font-medium text-red-600">
                    {d.soNgayTre}
                  </td>
                </tr>
              ))}
              {kq.danhSachTre.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-4 text-center text-gray-400"
                  >
                    Không có đơn trễ trong tháng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
