import Link from "next/link";
import { mayRepository } from "@/lib/repositories/may";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { taiMayTheoTuan } from "@/lib/domain/report";
import { cuoiTuan, dauTuan, todayVN } from "@/lib/domain/datetime";
import { NHAN_MAY_LOAI } from "@/lib/domain/labels";
import type { MayLoai } from "@/lib/domain/enums";
import { DateRange } from "@/components/date-range";
import { ExportButtons } from "@/components/export-button";

export const dynamic = "force-dynamic";

export default async function TaiMayPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const homNay = todayVN();
  const tuFrom = from ?? dauTuan(homNay);
  const toTo = to ?? cuoiTuan(homNay);

  const [mayList, lichAll] = await Promise.all([
    mayRepository.findAll(),
    lichChayRepository.findAll(),
  ]);

  const { items, maxTai } = taiMayTheoTuan({
    from: tuFrom,
    to: toTo,
    may: mayList,
    lichAll,
  });

  const excelSheets = [
    {
      name: "Tải máy",
      rows: items.map((m) => ({
        MaMay: m.maMay,
        TenMay: m.TenMay,
        Loai: NHAN_MAY_LOAI[m.Loai as MayLoai] ?? m.Loai,
        PhutBan: m.busyPhut,
        PhutKhaDung: m.capacityPhut,
        TaiPhanTram: Math.round(m.tai * 100),
        Nghen: m.nghen ? "Có" : "",
      })),
    },
  ];

  return (
    // Tiêu đề + chọn tuần cố định; danh sách tải máy là vùng cuộn.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/bao-cao" className="text-sm text-brand hover:underline">
            ← Báo cáo
          </Link>
          <h1 className="text-xl font-semibold">Tải máy</h1>
          <p className="text-sm text-gray-500">
            {tuFrom} → {toTo}
          </p>
        </div>
        <ExportButtons
          fileName={`tai-may-${tuFrom}_${toTo}.xlsx`}
          sheets={excelSheets}
        />
      </div>

      <div className="shrink-0">
        <DateRange from={tuFrom} to={toTo} homNay={homNay} mode="week" />
      </div>

      <section className="min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-3">
          {items.map((m) => {
            const pct = Math.round(m.tai * 100);
            const barColor = m.nghen
              ? "bg-red-500"
              : m.tai >= 0.6
                ? "bg-amber-400"
                : "bg-brand";
            return (
              <div key={m.maMay}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {m.TenMay}
                    <span className="ml-1 text-xs text-gray-400">
                      ({NHAN_MAY_LOAI[m.Loai as MayLoai] ?? m.Loai})
                    </span>
                    {m.nghen && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        nghẽn
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      m.nghen ? "font-semibold text-red-600" : "text-gray-600"
                    }
                  >
                    {pct}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              Chưa có máy nào.
            </p>
          )}
        </div>
        {items.length > 0 && (
          <p className="mt-4 text-xs text-gray-400">
            Máy tải cao nhất: <strong>{Math.round(maxTai * 100)}%</strong> —
            ngưỡng nghẽn 85%. % tải tính theo giờ làm việc trong khoảng đã chọn.
          </p>
        )}
      </section>
    </div>
  );
}
