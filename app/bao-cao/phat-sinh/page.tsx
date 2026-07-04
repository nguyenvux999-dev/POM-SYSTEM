import Link from "next/link";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { thongKePhatSinh } from "@/lib/domain/report";
import { cuoiThang, dauThang, todayVN } from "@/lib/domain/datetime";
import { NHAN_MUC_DO, NHAN_PHAT_SINH_LOAI } from "@/lib/domain/labels";
import { DateRange } from "@/components/date-range";
import { ExportButtons } from "@/components/export-button";

export const dynamic = "force-dynamic";

export default async function ThongKePhatSinhPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const homNay = todayVN();
  const tuFrom = from ?? dauThang(homNay);
  const toTo = to ?? cuoiThang(homNay);

  const phatSinhAll = await phatSinhRepository.findAll();
  const tk = thongKePhatSinh({ from: tuFrom, to: toTo, phatSinhAll });

  const excelSheets = [
    {
      name: "Theo loai",
      rows: tk.theoLoai.map((x) => ({
        Loai: NHAN_PHAT_SINH_LOAI[x.loai],
        SoLuong: x.soLuong,
      })),
    },
    {
      name: "Theo muc do",
      rows: tk.theoMucDo.map((x) => ({
        MucDo: NHAN_MUC_DO[x.mucDo],
        SoLuong: x.soLuong,
      })),
    },
  ];

  const maxLoai = tk.theoLoai.reduce((m, x) => Math.max(m, x.soLuong), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/bao-cao" className="text-sm text-brand hover:underline">
            ← Báo cáo
          </Link>
          <h1 className="text-xl font-semibold">Thống kê phát sinh</h1>
          <p className="text-sm text-gray-500">
            {tuFrom} → {toTo}
          </p>
        </div>
        <ExportButtons
          fileName={`phat-sinh-${tuFrom}_${toTo}.xlsx`}
          sheets={excelSheets}
        />
      </div>

      <DateRange from={tuFrom} to={toTo} homNay={homNay} mode="range" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold">{tk.tong}</div>
          <div className="text-xs text-gray-500">Tổng phát sinh</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold text-red-700">
            {tk.soAnhHuong}
          </div>
          <div className="text-xs text-gray-500">Ảnh hưởng tiến độ</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold">{tk.phanTramAnhHuong}%</div>
          <div className="text-xs text-gray-500">Tỷ lệ ảnh hưởng</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Loại sự cố hay gặp
          </h2>
          <div className="space-y-2">
            {tk.theoLoai.map((x) => (
              <div key={x.loai}>
                <div className="mb-0.5 flex justify-between text-sm">
                  <span>{NHAN_PHAT_SINH_LOAI[x.loai]}</span>
                  <span className="text-gray-500">{x.soLuong}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${maxLoai > 0 ? (x.soLuong / maxLoai) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {tk.theoLoai.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">
                Không có phát sinh trong khoảng.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Phân bố mức độ
          </h2>
          <div className="space-y-2">
            {tk.theoMucDo.map((x) => (
              <div
                key={x.mucDo}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
              >
                <span>{NHAN_MUC_DO[x.mucDo]}</span>
                <span className="font-medium">{x.soLuong}</span>
              </div>
            ))}
            {tk.theoMucDo.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">(không có)</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
