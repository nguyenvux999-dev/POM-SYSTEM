"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  addDaysLocal,
  cuoiThang,
  cuoiTuan,
  dauThang,
  dauTuan,
  formatDateLocal,
  parseLocal,
} from "@/lib/domain/datetime";

export type DateRangeMode = "day" | "week" | "month" | "range";

/**
 * Bộ lọc khoảng ngày dùng chung cho các báo cáo — đẩy `from`/`to` lên URL để
 * server component render lại. `homNay` do server truyền (tránh lệch múi giờ).
 *
 * - mode="day":   1 ngày (from=to). Preset Hôm nay / Hôm qua.
 * - mode="month": theo tháng (from=đầu tháng, to=cuối tháng). Preset Tháng này / trước.
 * - mode="week"/"range": khoảng ngày. Preset Tuần này / Tháng này / Hôm nay.
 */
export function DateRange({
  from,
  to,
  homNay,
  mode = "range",
}: {
  from: string;
  to: string;
  homNay: string;
  mode?: DateRangeMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(nf: string, nt: string) {
    const qs = new URLSearchParams();
    qs.set("from", nf);
    qs.set("to", nt);
    startTransition(() => router.push(`${pathname}?${qs.toString()}`));
  }

  const btn =
    "rounded-md border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100";
  const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm";

  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {mode === "day" && (
        <>
          <button type="button" className={btn} onClick={() => apply(homNay, homNay)}>
            Hôm nay
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const h = formatDateLocal(addDaysLocal(parseLocal(homNay), -1));
              apply(h, h);
            }}
          >
            Hôm qua
          </button>
          <input
            type="date"
            className={inputCls}
            value={from}
            onChange={(e) => apply(e.target.value, e.target.value)}
          />
        </>
      )}

      {mode === "month" && (
        <>
          <button
            type="button"
            className={btn}
            onClick={() => apply(dauThang(homNay), cuoiThang(homNay))}
          >
            Tháng này
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const truoc = formatDateLocal(
                addDaysLocal(parseLocal(dauThang(homNay)), -1),
              );
              apply(dauThang(truoc), cuoiThang(truoc));
            }}
          >
            Tháng trước
          </button>
          <input
            type="month"
            className={inputCls}
            value={from.slice(0, 7)}
            onChange={(e) =>
              apply(dauThang(`${e.target.value}-01`), cuoiThang(`${e.target.value}-01`))
            }
          />
        </>
      )}

      {(mode === "week" || mode === "range") && (
        <>
          <button type="button" className={btn} onClick={() => apply(homNay, homNay)}>
            Hôm nay
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => apply(dauTuan(homNay), cuoiTuan(homNay))}
          >
            Tuần này
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => apply(dauThang(homNay), cuoiThang(homNay))}
          >
            Tháng này
          </button>
          <div className="flex items-center gap-1">
            <input
              type="date"
              className={inputCls}
              value={from}
              onChange={(e) => apply(e.target.value, to)}
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              className={inputCls}
              value={to}
              onChange={(e) => apply(from, e.target.value)}
            />
          </div>
        </>
      )}

      {pending && <span className="text-xs text-gray-400">Đang tải…</span>}
    </div>
  );
}
