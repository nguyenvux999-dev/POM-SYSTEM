/**
 * 3 trợ lý quyết định trên Planning Board (THUẦN — dùng được cả server & client).
 *  1. Cảnh báo trễ hạn  (2.6)
 *  2. Gợi ý gom màu/khổ  (2.7)
 *  3. Tải máy & cảnh báo dồn công đoạn sau  (2.8)
 *
 * Đây là GỢI Ý cho planner; không tự động thay đổi lịch.
 */

import type { LichChay, May } from "./types";
import { GIO_LAM_VIEC_MOI_NGAY, NGAY_NGHI } from "./config";
import { parseLocal, workingMinutesBetween } from "./datetime";

// ---------------------------------------------------------------------------
// 2.6 — Cảnh báo trễ hạn
// ---------------------------------------------------------------------------

/** KetThucDuKien muộn nhất trong một tập LichChay ("YYYY-MM-DD HH:mm"); rỗng → null. */
export function ketThucCuoiCung(lich: LichChay[]): string | null {
  let best: string | null = null;
  for (const l of lich) {
    if (!l.KetThucDuKien) continue;
    if (best === null || l.KetThucDuKien > best) best = l.KetThucDuKien;
  }
  return best;
}

/**
 * Lệnh bị trễ nếu công đoạn cuối kết thúc SAU hạn hoàn thành.
 * Hạn (date) được coi là hết ngày (23:59) để không báo trễ oan trong ngày hạn.
 */
export function treHan(
  ketThucCuoi: string | null,
  hanHoanThanh: string,
): boolean {
  if (!ketThucCuoi || !hanHoanThanh) return false;
  const end = parseLocal(ketThucCuoi);
  const han = parseLocal(hanHoanThanh);
  if (Number.isNaN(end.getTime()) || Number.isNaN(han.getTime())) return false;
  const hanCuoiNgay = han.getTime() + (24 * 60 - 1) * 60_000;
  return end.getTime() > hanCuoiNgay;
}

// ---------------------------------------------------------------------------
// 2.7 — Gom màu / khổ / loại giấy
// ---------------------------------------------------------------------------

export interface ThongSoGom {
  SoMau: string;
  LoaiGiay: string;
  KhoThanhPham: string;
}

/** Khóa gom: cùng SoMau + LoaiGiay + KhoThanhPham (chuẩn hóa thường, bỏ khoảng trắng thừa). */
export function khoaGom(t: ThongSoGom): string {
  return [t.SoMau, t.LoaiGiay, t.KhoThanhPham]
    .map((x) => (x ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * Tập các khóa gom "đáng chú ý" = có ≥2 phần tử cùng thông số (bỏ nhóm toàn rỗng).
 * Dùng để tô viền/nhãn nhắc planner xếp liền nhau nhằm giảm make-ready.
 */
export function khoaDangGom(items: ThongSoGom[]): Set<string> {
  const dem = new Map<string, number>();
  for (const it of items) {
    const k = khoaGom(it);
    if (!k.replace(/\|/g, "")) continue; // toàn rỗng → bỏ
    dem.set(k, (dem.get(k) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [k, n] of dem) if (n > 1) out.add(k);
  return out;
}

// ---------------------------------------------------------------------------
// 2.8 — Tải máy & cảnh báo dồn
// ---------------------------------------------------------------------------

/** Số ngày làm việc (bỏ ngày nghỉ) trong khoảng [from, to] tính theo ngày. */
export function soNgayLamViec(from: Date, to: Date): number {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  let n = 0;
  let cur = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  for (let i = 0; i < 400 && cur.getTime() <= end; i++) {
    if (!NGAY_NGHI.includes(cur.getUTCDay())) n++;
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return n;
}

export interface TaiMay {
  maMay: string;
  busyPhut: number;
  capacityPhut: number;
  /** Tỷ lệ tải (0..1+); >1 nghĩa là quá công suất trong cửa sổ. */
  tai: number;
  quaTai: boolean;
}

/**
 * % tải mỗi máy trong cửa sổ [from, to]: Σ phút làm việc của job trên máy / tổng
 * giờ làm khả dụng. Chỉ đếm phần thời lượng NẰM TRONG giờ làm & trong cửa sổ.
 */
export function tinhTaiMay(
  may: May[],
  lich: LichChay[],
  from: Date,
  to: Date,
): TaiMay[] {
  const capacityPhut = soNgayLamViec(from, to) * GIO_LAM_VIEC_MOI_NGAY * 60;
  return may.map((m) => {
    let busy = 0;
    for (const l of lich) {
      if (l.MaMay !== m.MaMay) continue;
      const s = parseLocal(l.BatDauDuKien);
      const e = parseLocal(l.KetThucDuKien);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
      const a = new Date(Math.max(s.getTime(), from.getTime()));
      const b = new Date(Math.min(e.getTime(), to.getTime()));
      busy += workingMinutesBetween(a, b);
    }
    const tai = capacityPhut > 0 ? busy / capacityPhut : 0;
    return {
      maMay: m.MaMay,
      busyPhut: Math.round(busy),
      capacityPhut,
      tai,
      quaTai: tai > 1,
    };
  });
}
