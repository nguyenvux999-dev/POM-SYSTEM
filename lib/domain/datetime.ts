/**
 * Tiện ích ngày/giờ (thuần, không import server-only).
 *
 * Toàn bộ tính theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) để nhất quán dù server
 * chạy ở UTC (Vercel). Ở Pha 1 ngày/giờ vẫn lưu dạng chuỗi.
 */

const TZ = "Asia/Ho_Chi_Minh";

function vnParts(d: Date): {
  y: string;
  mo: string;
  d: string;
  h: string;
  mi: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
  };
}

/** Dấu thời gian hiện tại theo VN, dạng "YYYY-MM-DD HH:mm". */
export function nowStamp(): string {
  const p = vnParts(new Date());
  return `${p.y}-${p.mo}-${p.d} ${p.h}:${p.mi}`;
}

/** Ngày hôm nay theo VN, dạng "YYYY-MM-DD". */
export function todayVN(): string {
  const p = vnParts(new Date());
  return `${p.y}-${p.mo}-${p.d}`;
}

/** Năm hiện tại theo VN (số). */
export function currentYearVN(): number {
  return Number(vnParts(new Date()).y);
}

/**
 * Số ngày lịch giữa hai ngày dạng "YYYY-MM-DD" (b - a). Không hợp lệ -> NaN.
 * Dùng mốc 00:00 UTC cho cả hai để tránh lệch do múi giờ.
 */
export function soNgayGiua(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.NaN;
  return Math.round((tb - ta) / 86_400_000);
}
