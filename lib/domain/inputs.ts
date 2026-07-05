/**
 * DTO nhập liệu (thuần) — dùng chung giữa Server Action và form phía client.
 * Không chứa các trường hệ thống (MaXxx, NguoiCapNhat, NgayCapNhat) — server tự set.
 */

import type { DoUuTien, MucDo, PhatSinhLoai } from "./enums";

/** Dữ liệu tạo đơn hàng mới (TrangThai luôn = "Moi", server set). */
export interface DonHangInput {
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
  GhiChu: string;
}

/**
 * Dữ liệu một lệnh sản xuất khi tạo từ chi tiết đơn.
 * `CongDoanCanLam` là MẢNG ở tầng UI; repo sẽ nối bằng ";" khi lưu.
 * Các trường sản xuất bổ sung đều TÙY CHỌN (SoMau/LoaiGiay đọc từ DonHang, không nhập ở đây).
 */
export interface LenhDraftInput {
  MoTaCongViec: string;
  CongDoanCanLam: string[];
  DoUuTien: DoUuTien;
  HanHoanThanh: string;
  MaLSXXuong?: string;
  SoTrang?: number;
  KhoGiay?: string;
  KhoIn?: string;
  BuHaoPhanTram?: number;
  /** Số tờ in của mẻ (bắt buộc) — dùng để tính thời lượng. */
  SoToIn?: number;
}

/** Một dòng mã sản phẩm nhập trong form lệnh (THUẦN MÔ TẢ). */
export interface MaSanPhamInput {
  MaSanPham: string;
  TenSanPham: string;
  KichThuoc: string;
  SoLuong: number;
}

/**
 * Dữ liệu SỬA một lệnh (từ màn chi tiết đơn). `CongDoanCanLam` là MẢNG (repo nối ";").
 * Server tự kiểm quyền trước khi ghi: trường ẢNH HƯỞNG LỊCH chỉ được ghi khi cho phép.
 */
export interface LenhEditInput {
  // Vô hại
  MoTaCongViec: string;
  MaLSXXuong?: string;
  DoUuTien: DoUuTien;
  SoTrang?: number;
  KhoGiay?: string;
  KhoIn?: string;
  // Ảnh hưởng lịch
  CongDoanCanLam: string[];
  BuHaoPhanTram?: number;
  HanHoanThanh: string;
  SoToIn?: number;
}

/**
 * Dữ liệu ghi một phát sinh (server tự set MaPhatSinh, ThoiGian, TrangThai=Moi,
 * NguoiCapNhat). MaLenh phải là lệnh đang tồn tại.
 */
export interface PhatSinhInput {
  MaLenh: string;
  Loai: PhatSinhLoai;
  MoTa: string;
  MucDo: MucDo;
  AnhHuongTienDo: boolean;
  HuongXuLy: string;
}
