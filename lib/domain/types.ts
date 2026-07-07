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
  // --- Trường sản xuất bổ sung (đều TÙY CHỌN; dòng dữ liệu cũ không có → undefined). ---
  // Lưu ý: SoMau & LoaiGiay KHÔNG ở đây — đã có trong DonHang, đọc qua join.
  /** Mã lệnh theo định dạng xưởng, vd "OS-25SL3101-30062026-3". Bỏ trống → dùng MaLenh. */
  MaLSXXuong?: string;
  /** Số trang (cho sản phẩm sách); 0/trống = không áp dụng. */
  SoTrang?: number;
  /** Khổ giấy, vd "700x965mm". */
  KhoGiay?: string;
  /** Khổ in, vd "700x475mm". */
  KhoIn?: string;
  /** % bù hao. Trống/0 → dùng BU_HAO_MAC_DINH_PHAN_TRAM khi tính thời lượng. */
  BuHaoPhanTram?: number;
  /**
   * Số tờ IN của mẻ (nhập tay). Đây là "số lượng" đưa vào công thức tính thời
   * lượng (cùng bù hao) — KHÔNG phải tổng SL các mã sản phẩm (vì in ghép).
   */
  SoToIn?: number;
}

/**
 * Tab `MaSanPham` — một mã sản phẩm in ghép trong lệnh. Khóa chính: MaDongSP. FK: MaLenh.
 * THUẦN MÔ TẢ: không có công đoạn/lịch/tiến độ (những thứ đó ở cấp LỆNH).
 */
export interface MaSanPham {
  MaDongSP: string;
  MaLenh: string;
  MaSanPham: string;
  TenSanPham: string;
  KichThuoc: string;
  /** Số lượng THÀNH PHẨM của riêng mã này (mô tả, không dùng để tính thời lượng). */
  SoLuong: number;
  NguoiCapNhat: string;
  NgayCapNhat: string;
}

/**
 * Tab `ThuVienSanPham` — thư viện tra cứu mã sản phẩm kèm ảnh (product master).
 * Khóa chính: MaSanPham. Module ĐỘC LẬP — không FK tới lệnh/đơn/lịch.
 */
export interface ThuVienSanPham {
  MaSanPham: string;
  TenSanPham: string;
  KhachHang: string;
  /** URL ảnh công khai trên Vercel Blob; trống = chưa có ảnh (UI hiện placeholder). */
  AnhUrl: string;
  KhoThanhPham: string;
  LoaiGiay: string;
  GhiChu: string;
  NgayCapNhat: string;
  /** Tùy chọn vì sheet cũ có thể chưa có cột này (seed sẽ bổ sung vào cuối header). */
  NguoiCapNhat?: string;
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
