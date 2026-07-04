/**
 * Tiện ích ngày/giờ (thuần, không import server-only).
 *
 * Toàn bộ tính theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) để nhất quán dù server
 * chạy ở UTC (Vercel). Ở Pha 1 ngày/giờ vẫn lưu dạng chuỗi.
 */

import {
  GIO_BAT_DAU_LAM,
  GIO_LAM_VIEC_MOI_NGAY,
  NGAY_NGHI,
} from "./config";

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

// ---------------------------------------------------------------------------
// Pha 2 — mốc thời gian dùng để TÍNH TOÁN lịch chạy máy.
//
// Chiến lược "wall-clock lưu như UTC": mọi chuỗi "YYYY-MM-DD HH:mm" được coi là
// giờ địa phương (Asia/Ho_Chi_Minh, không có DST) và ánh xạ 1-1 vào một Date qua
// Date.UTC. Nhờ vậy mọi phép cộng/so sánh dùng các hàm getUTC* cho ra ĐÚNG
// wall-clock ban đầu, độc lập với TZ của server (Vercel = UTC) → không lệch ngày.
// Đọc lại bằng formatLocal cũng bằng getUTC* nên khứ hồi không đổi.
// ---------------------------------------------------------------------------

/** Parse "YYYY-MM-DD" hoặc "YYYY-MM-DD HH:mm" → Date (wall-clock). Sai → Invalid Date. */
export function parseLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(
    String(s).trim(),
  );
  if (!m) return new Date(Number.NaN);
  const [, y, mo, d, h, mi] = m;
  return new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 0, mi ? Number(mi) : 0),
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date → "YYYY-MM-DD HH:mm" (wall-clock). Invalid Date → "". */
export function formatLocal(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Date → "YYYY-MM-DD" (chỉ ngày, wall-clock). Invalid Date → "". */
export function formatDateLocal(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** "Bây giờ" theo wall-clock VN, ở cùng không gian với parseLocal/addWorkingMinutes. */
export function nowLocal(): Date {
  return parseLocal(nowStamp());
}

/** Thứ Hai của tuần chứa ngày "YYYY-MM-DD" (trả "YYYY-MM-DD"). */
export function dauTuan(ymd: string): string {
  const d = parseLocal(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return formatDateLocal(addDaysLocal(d, -dow));
}

/** Chủ nhật của tuần chứa ngày "YYYY-MM-DD". */
export function cuoiTuan(ymd: string): string {
  const d = parseLocal(dauTuan(ymd));
  return formatDateLocal(addDaysLocal(d, 6));
}

/** Ngày đầu tháng của "YYYY-MM-DD" (hoặc "YYYY-MM") → "YYYY-MM-01". */
export function dauThang(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Ngày cuối tháng của "YYYY-MM-DD" (hoặc "YYYY-MM") → "YYYY-MM-DD". */
export function cuoiThang(ymd: string): string {
  const d = parseLocal(dauThang(ymd));
  if (Number.isNaN(d.getTime())) return ymd;
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${ymd.slice(0, 7)}-${pad2(last)}`;
}

/** Cộng n ngày lịch (giữ nguyên giờ:phút). */
export function addDaysLocal(d: Date, n: number): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + n,
      d.getUTCHours(),
      d.getUTCMinutes(),
    ),
  );
}

// --- Khung giờ làm việc ---

/** Phân tích GIO_BAT_DAU_LAM ("HH:mm") → [giờ, phút]. */
function gioBatDau(): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(GIO_BAT_DAU_LAM.trim());
  if (!m) return [8, 0];
  return [Number(m[1]), Number(m[2])];
}

function laNgayLamViec(d: Date): boolean {
  return !NGAY_NGHI.includes(d.getUTCDay());
}

/** Mốc bắt đầu cửa sổ làm việc của NGÀY chứa d. */
function dauCuaSo(d: Date): Date {
  const [h, mi] = gioBatDau();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, mi),
  );
}

/** Mốc kết thúc cửa sổ làm việc của NGÀY chứa d (= đầu + GIO_LAM_VIEC_MOI_NGAY giờ). */
function cuoiCuaSo(d: Date): Date {
  return new Date(
    dauCuaSo(d).getTime() + GIO_LAM_VIEC_MOI_NGAY * 60 * 60_000,
  );
}

/**
 * Mốc làm việc hợp lệ SỚM NHẤT ≥ d: nếu d nằm trong một cửa sổ làm việc → giữ
 * nguyên; nếu trước giờ vào ca → đầu ca hôm đó; nếu sau giờ tan ca hoặc rơi vào
 * ngày nghỉ → đầu ca của ngày làm việc kế tiếp.
 */
export function dauCaLamViecKeTiep(d: Date): Date {
  let cur = d;
  for (let i = 0; i < 400; i++) {
    if (laNgayLamViec(cur)) {
      const start = dauCuaSo(cur);
      const end = cuoiCuaSo(cur);
      if (cur.getTime() < start.getTime()) return start;
      if (cur.getTime() < end.getTime()) return cur;
    }
    const [h, mi] = gioBatDau();
    cur = new Date(
      Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1, h, mi),
    );
  }
  throw new Error(
    "Không tìm được ngày làm việc trong 400 ngày — kiểm tra NGAY_NGHI / GIO_LAM_VIEC_MOI_NGAY.",
  );
}

/**
 * Cộng `minutes` phút LÀM VIỆC vào `start`, tôn trọng khung giờ làm mỗi ngày và
 * bỏ qua ngày nghỉ. `start` bị kẹp vào cửa sổ làm việc hợp lệ trước khi cộng, nên
 * addWorkingMinutes(x, 0) trả về mốc bắt đầu làm việc thực tế của x.
 */
export function addWorkingMinutes(start: Date, minutes: number): Date {
  if (!(GIO_LAM_VIEC_MOI_NGAY > 0)) {
    throw new Error("GIO_LAM_VIEC_MOI_NGAY phải > 0 để tính lịch.");
  }
  let cur = dauCaLamViecKeTiep(start);
  let remaining = Math.max(0, Math.round(minutes));
  let guard = 0;
  while (remaining > 0) {
    if (guard++ > 100_000) {
      throw new Error("addWorkingMinutes: vòng lặp bất thường.");
    }
    const conLaiHomNay = Math.round((cuoiCuaSo(cur).getTime() - cur.getTime()) / 60_000);
    if (remaining <= conLaiHomNay) {
      cur = new Date(cur.getTime() + remaining * 60_000);
      remaining = 0;
    } else {
      remaining -= conLaiHomNay;
      const [h, mi] = gioBatDau();
      cur = dauCaLamViecKeTiep(
        new Date(
          Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1, h, mi),
        ),
      );
    }
  }
  return cur;
}

/**
 * Tổng số PHÚT LÀM VIỆC nằm trong khoảng [a, b) (bỏ giờ ngoài ca & ngày nghỉ).
 * Dùng để tính % tải máy (trợ lý 3) mà không thổi phồng bởi thời gian qua đêm.
 */
export function workingMinutesBetween(a: Date, b: Date): number {
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  if (b.getTime() <= a.getTime()) return 0;
  let total = 0;
  let cur = a;
  let guard = 0;
  while (cur.getTime() < b.getTime()) {
    if (guard++ > 100_000) break;
    if (laNgayLamViec(cur)) {
      const start = dauCuaSo(cur).getTime();
      const end = cuoiCuaSo(cur).getTime();
      const segStart = Math.max(cur.getTime(), start);
      const segEnd = Math.min(b.getTime(), end);
      if (segEnd > segStart) total += (segEnd - segStart) / 60_000;
    }
    cur = new Date(
      Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1),
    );
  }
  return Math.round(total);
}
