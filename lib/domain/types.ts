/**
 * 7 interface thực thể — nguồn chân lý khớp 1-1 với cột trong các tab Google Sheets.
 *
 * Quy ước kiểu:
 *  - date / datetime lưu & đọc như `string` (vd "2026-07-03", "2026-07-03 08:00").
 *    Chưa parse thành Date.
 *  - number cho các cột số; boolean cho cột TRUE/FALSE.
 *  - Các cột enum dùng union type từ enums.ts.
 */

import type {
  CongDoan,
  DoUuTien,
  DonHangTrangThai,
  LenhTrangThai,
  LichTrangThai,
  MayLoai,
  MayTrangThai,
  MucDo,
  PhatSinhLoai,
  PhatSinhTrangThai,
  TrangThaiFile,
  VaiTro,
} from "./enums";

/** Tab `DonHang` — Đơn hàng. Khóa chính: MaDon. */
export interface DonHang {
  MaDon: string;
  NgayNhan: string;
  KhachHang: string;
  NVKinhDoanh: string;
  TenSanPham: string;
  SoLuong: number;
  KhoThanhPham: string;
  LoaiGiay: string;
  SoMau: string;
  GiaCongSauIn: string;
  NgayGiaoHang: string;
  TrangThai: DonHangTrangThai;
  GhiChu: string;
  NguoiCapNhat: string;
  NgayCapNhat: string;
}

/** Tab `LenhSanXuat` — Lệnh sản xuất. Khóa chính: MaLenh. FK: MaDon. */
export interface LenhSanXuat {
  MaLenh: string;
  MaDon: string;
  MoTaCongViec: string;
  /** Chuỗi công đoạn ngăn cách bằng ";" — vd "In;CanMang;Be". */
  CongDoanCanLam: string;
  TrangThaiFile: TrangThaiFile;
  DoUuTien: DoUuTien;
  HanHoanThanh: string;
  TrangThai: LenhTrangThai;
  NguoiCapNhat: string;
  NgayCapNhat: string;
}

/** Tab `May` — Máy móc & năng lực. Khóa chính: MaMay. */
export interface May {
  MaMay: string;
  TenMay: string;
  Loai: MayLoai;
  KhoToiDa: string;
  /** Năng suất tờ/giờ. */
  NangSuat: number;
  /** Thời gian make-ready (phút). */
  ThoiGianMakeReady: number;
  TrangThai: MayTrangThai;
  NguoiCapNhat: string;
  NgayCapNhat: string;
}

/** Tab `LichChay` — Lịch chạy máy. Khóa chính: MaLich. FK: MaLenh, MaMay. */
export interface LichChay {
  MaLich: string;
  MaLenh: string;
  CongDoan: CongDoan;
  MaMay: string;
  ThuTu: number;
  BatDauDuKien: string;
  KetThucDuKien: string;
  NguoiPhuTrach: string;
  TrangThai: LichTrangThai;
  NguoiCapNhat: string;
  NgayCapNhat: string;
}

/**
 * Tab `TienDo` — Nhật ký tiến độ (APPEND-ONLY). Khóa chính: MaLog. FK: MaLenh.
 * Lưu ý: bảng này chỉ được thêm dòng, không sửa/xóa (xem tienDo repository).
 */
export interface TienDo {
  MaLog: string;
  MaLenh: string;
  CongDoan: CongDoan;
  ThoiGian: string;
  /** Trạng thái mới ghi nhận — để chuỗi tự do. */
  TrangThaiMoi: string;
  SoLuongDat: number;
  NguoiCapNhat: string;
  GhiChu: string;
}

/** Tab `PhatSinh` — Sự cố phát sinh. Khóa chính: MaPhatSinh. FK: MaLenh. */
export interface PhatSinh {
  MaPhatSinh: string;
  MaLenh: string;
  Loai: PhatSinhLoai;
  MoTa: string;
  MucDo: MucDo;
  AnhHuongTienDo: boolean;
  HuongXuLy: string;
  TrangThai: PhatSinhTrangThai;
  ThoiGian: string;
  NguoiCapNhat: string;
}

/** Tab `NguoiDung` — Phân quyền. Khóa chính: Email. */
export interface NguoiDung {
  Email: string;
  HoTen: string;
  VaiTro: VaiTro;
  BoPhan: string;
}
