/**
 * 1.4 — Ước tính thời lượng công đoạn / lệnh (THUẦN, không import server-only).
 *
 * Công thức một công đoạn:
 *   thoiLuongPhut = ThoiGianMakeReady + (SoLuong / NangSuat) × 60
 *
 * - Công đoạn có máy chuyên (In/CanMang/Be/Dan): dùng máy NHANH NHẤT thuộc loại
 *   tương ứng đang HoatDong (NangSuat lớn nhất + make-ready của chính máy đó).
 * - Công đoạn không có máy chuyên (DongGhim/EpKim/Khac): dùng CONGDOAN_KHAC_*.
 *
 * Bảng năng lực (BangNangLuc) được suy từ May[] ở server rồi truyền xuống, nên
 * hàm này chạy được cả ở server LẪN client mà không cần gọi Sheets từ client.
 */

import type { May } from "./types";
import {
  CONGDOAN_KHAC_MAKEREADY_PHUT,
  CONGDOAN_KHAC_NANGSUAT,
  CONGDOAN_MAY,
} from "./config";

/** Năng lực đại diện của một loại máy (máy nhanh nhất đang hoạt động). */
export interface NangSuatMay {
  nangSuat: number;
  makeReady: number;
}

/** key = Loai máy (InOffset/CanMang/Be/Dan/...). */
export type BangNangLuc = Record<string, NangSuatMay>;

/** Suy bảng năng lực từ danh sách máy: mỗi Loai lấy máy HoatDong nhanh nhất. */
export function bangNangLucTuMay(may: May[]): BangNangLuc {
  const out: BangNangLuc = {};
  for (const m of may) {
    if (m.TrangThai !== "HoatDong") continue;
    const cur = out[m.Loai];
    if (!cur || m.NangSuat > cur.nangSuat) {
      out[m.Loai] = { nangSuat: m.NangSuat, makeReady: m.ThoiGianMakeReady };
    }
  }
  return out;
}

/** Thời lượng (phút) của MỘT công đoạn cho số lượng cho trước. */
export function thoiLuongCongDoanPhut(
  soLuong: number,
  congDoan: string,
  bang: BangNangLuc,
): number {
  const loai = CONGDOAN_MAY[congDoan];
  const nl = loai ? bang[loai] : undefined;
  const nangSuat = nl ? nl.nangSuat : CONGDOAN_KHAC_NANGSUAT;
  const makeReady = nl ? nl.makeReady : CONGDOAN_KHAC_MAKEREADY_PHUT;
  const sl = Number.isFinite(soLuong) && soLuong > 0 ? soLuong : 0;
  if (nangSuat <= 0) return makeReady;
  return makeReady + (sl / nangSuat) * 60;
}

/** Tổng thời lượng (phút) của tất cả công đoạn trong một lệnh. */
export function uocTinhThoiLuongLenhPhut(
  soLuong: number,
  congDoanCanLam: string[],
  bang: BangNangLuc,
): number {
  return congDoanCanLam.reduce(
    (sum, cd) => sum + thoiLuongCongDoanPhut(soLuong, cd, bang),
    0,
  );
}
