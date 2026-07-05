/**
 * 1.10 — Gate SanSang + quy tắc SỬA/XÓA lệnh (THUẦN — dùng ở cả UI lẫn Server Action).
 *
 * Một lệnh chỉ được đưa vào xếp lịch khi file đã "SanSang". Dùng để gắn nhãn
 * "Sẵn sàng xếp lịch" và để chặn xếp lịch khi lệnh chưa sẵn sàng.
 *
 * Quy tắc sửa/xóa (quyenSuaXoaLenh) dựa trên DỮ LIỆU CON THẬT (coLichChay/coTienDo)
 * + trạng thái HoanThanh — KHÔNG chỉ tin cột TrangThai (giá trị suy ra có thể lệch).
 */

import type { LenhSanXuat, LichChay } from "./types";
import type { DonHangTrangThai, LenhTrangThai } from "./enums";

export function coTheXepLich(
  lenh: Pick<LenhSanXuat, "TrangThaiFile">,
): boolean {
  return lenh.TrangThaiFile === "SanSang";
}

// ---------------------------------------------------------------------------
// Phân loại trường khi sửa lệnh
// ---------------------------------------------------------------------------

/** Trường VÔ HẠI — sửa KHÔNG ảnh hưởng lịch đã xếp. */
export const TRUONG_VO_HAI = [
  "MoTaCongViec",
  "MaLSXXuong",
  "DoUuTien",
  "SoTrang",
  "KhoGiay",
  "KhoIn",
] as const;

/** Trường ẢNH HƯỞNG LỊCH — đổi thì lịch đã xếp có thể sai, cần xếp lại. */
export const TRUONG_ANH_HUONG_LICH = [
  "CongDoanCanLam",
  "BuHaoPhanTram",
  "HanHoanThanh",
] as const;

// ---------------------------------------------------------------------------
// Quy tắc cho phép sửa/xóa
// ---------------------------------------------------------------------------

/** "Mức" của lệnh theo thứ tự ưu tiên kiểm tra. */
export type MucLenh = "HoanThanh" | "DaChay" | "DaXepLich" | "ChuaXep";

export interface QuyenLenh {
  muc: MucLenh;
  /** HoanThanh → khóa hoàn toàn (không sửa, không xóa). */
  chiDoc: boolean;
  /** Được sửa trường ẢNH HƯỞNG LỊCH không (công đoạn/bù hao/hạn). */
  suaAnhHuongLich: boolean;
  /** Sửa trường ẢNH HƯỞNG LỊCH sẽ khiến lịch đã xếp sai → cần xếp lại. */
  canhBaoXepLai: boolean;
  /** Được xóa lệnh không. */
  xoaDuoc: boolean;
  /** Xóa phải dọn kèm LichChay + cần xác nhận. */
  xoaKemLich: boolean;
  /** Lý do khóa (hiển thị khi bị chặn). */
  lyDoKhoaSua?: string;
  lyDoKhoaXoa?: string;
}

/** Có lịch và MỌI dòng đều Xong → coi như đã hoàn thành (dù cột TrangThai lệch). */
export function moiLichDaXong(lich: Pick<LichChay, "TrangThai">[]): boolean {
  return lich.length > 0 && lich.every((l) => l.TrangThai === "Xong");
}

/**
 * Xác định quyền sửa/xóa của một lệnh từ DỮ LIỆU CON THẬT + trạng thái.
 * Thứ tự: HoanThanh > coTienDo > coLichChay > chưa xếp.
 */
export function quyenSuaXoaLenh(input: {
  trangThai: LenhTrangThai;
  coLichChay: boolean;
  coTienDo: boolean;
  moiLichXong: boolean;
}): QuyenLenh {
  const { trangThai, coLichChay, coTienDo, moiLichXong } = input;
  const hoanThanh = trangThai === "HoanThanh" || (coLichChay && moiLichXong);

  if (hoanThanh) {
    return {
      muc: "HoanThanh",
      chiDoc: true,
      suaAnhHuongLich: false,
      canhBaoXepLai: false,
      xoaDuoc: false,
      xoaKemLich: false,
      lyDoKhoaSua: "Lệnh đã hoàn thành — chỉ đọc, không thể sửa.",
      lyDoKhoaXoa: "Lệnh đã hoàn thành — không thể xóa (giữ lịch sử sản xuất).",
    };
  }
  if (coTienDo) {
    return {
      muc: "DaChay",
      chiDoc: false,
      suaAnhHuongLich: false,
      canhBaoXepLai: false,
      xoaDuoc: false,
      xoaKemLich: false,
      lyDoKhoaSua:
        "Lệnh đã bắt đầu chạy, không thể đổi công đoạn/bù hao/hạn.",
      lyDoKhoaXoa:
        "Lệnh đã bắt đầu chạy (có tiến độ) — không thể xóa (mất lịch sử sản xuất).",
    };
  }
  if (coLichChay) {
    return {
      muc: "DaXepLich",
      chiDoc: false,
      suaAnhHuongLich: true,
      canhBaoXepLai: true,
      xoaDuoc: true,
      xoaKemLich: true,
    };
  }
  return {
    muc: "ChuaXep",
    chiDoc: false,
    suaAnhHuongLich: true,
    canhBaoXepLai: false,
    xoaDuoc: true,
    xoaKemLich: false,
  };
}

/**
 * Suy TrangThai ĐƠN từ tập lệnh CÒN LẠI (dùng sau khi xóa lệnh cho nhất quán).
 * KHÔNG áp cho đơn Huy/TreHen (do người đặt tay) — xử lý ở tầng gọi.
 */
export function suyTrangThaiDonTuLenh(
  lenhsConLai: Pick<LenhSanXuat, "TrangThai">[],
): DonHangTrangThai {
  if (lenhsConLai.length === 0) return "Moi";
  if (lenhsConLai.every((l) => l.TrangThai === "HoanThanh")) return "HoanThanh";
  if (lenhsConLai.some((l) => l.TrangThai === "DangChay")) return "DangSanXuat";
  if (
    lenhsConLai.every((l) =>
      ["DaLenLich", "DangChay", "HoanThanh"].includes(l.TrangThai),
    )
  ) {
    return "DaLenLich";
  }
  return "ChoCheBan";
}
