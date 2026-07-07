/**
 * Định nghĩa cột (header) của từng tab — NGUỒN CHÂN LÝ duy nhất.
 *
 * Module này CỐ Ý giữ "thuần" (không import "server-only", không import Sheets)
 * để cả repository (runtime, server-only) LẪN script seed (chạy bằng tsx/Node)
 * đều import được mà không vỡ.
 *
 * Thứ tự phần tử = thứ tự cột trên dòng tiêu đề của sheet.
 */

import type { May } from "./types";

export const DON_HANG_COLUMNS = [
  "MaDon",
  "NgayNhan",
  "KhachHang",
  "NVKinhDoanh",
  "TenSanPham",
  "SoLuong",
  "KhoThanhPham",
  "LoaiGiay",
  "SoMau",
  "GiaCongSauIn",
  "NgayGiaoHang",
  "TrangThai",
  "GhiChu",
  "NguoiCapNhat",
  "NgayCapNhat",
] as const;

export const LENH_SAN_XUAT_COLUMNS = [
  "MaLenh",
  "MaDon",
  "MoTaCongViec",
  "CongDoanCanLam",
  "TrangThaiFile",
  "DoUuTien",
  "HanHoanThanh",
  "TrangThai",
  "NguoiCapNhat",
  "NgayCapNhat",
  // Trường sản xuất bổ sung (thêm vào CUỐI header — dữ liệu cũ vẫn đọc bình thường).
  // SoMau/LoaiGiay KHÔNG lặp ở đây: đã có trong DonHang, đọc qua join.
  "MaLSXXuong",
  "SoTrang",
  "KhoGiay",
  "KhoIn",
  "BuHaoPhanTram",
  // Số tờ IN của mẻ (nhập tay) — nhiều mã in ghép trên 1 tờ nên KHÁC tổng SL mã SP.
  // Đây là "số lượng" đưa vào công thức tính thời lượng (cùng bù hao).
  "SoToIn",
] as const;

export const MAY_COLUMNS = [
  "MaMay",
  "TenMay",
  "Loai",
  "KhoToiDa",
  "NangSuat",
  "ThoiGianMakeReady",
  "TrangThai",
  "NguoiCapNhat",
  "NgayCapNhat",
] as const;

export const LICH_CHAY_COLUMNS = [
  "MaLich",
  "MaLenh",
  "CongDoan",
  "MaMay",
  "ThuTu",
  "BatDauDuKien",
  "KetThucDuKien",
  "NguoiPhuTrach",
  "TrangThai",
  "NguoiCapNhat",
  "NgayCapNhat",
] as const;

export const TIEN_DO_COLUMNS = [
  "MaLog",
  "MaLenh",
  "CongDoan",
  "ThoiGian",
  "TrangThaiMoi",
  "SoLuongDat",
  "NguoiCapNhat",
  "GhiChu",
] as const;

export const PHAT_SINH_COLUMNS = [
  "MaPhatSinh",
  "MaLenh",
  "Loai",
  "MoTa",
  "MucDo",
  "AnhHuongTienDo",
  "HuongXuLy",
  "TrangThai",
  "ThoiGian",
  "NguoiCapNhat",
] as const;

export const NGUOI_DUNG_COLUMNS = [
  "Email",
  "HoTen",
  "VaiTro",
  "BoPhan",
] as const;

/**
 * Tab `MaSanPham` — các mã sản phẩm in GHÉP CHUNG trong một lệnh (dòng con của lệnh,
 * THUẦN MÔ TẢ). KHÔNG có công đoạn/lịch/tiến độ — những thứ đó ở cấp LỆNH.
 */
export const MA_SAN_PHAM_COLUMNS = [
  "MaDongSP",
  "MaLenh",
  "MaSanPham",
  "TenSanPham",
  "KichThuoc",
  "SoLuong",
  "NguoiCapNhat",
  "NgayCapNhat",
] as const;

/**
 * Tab `ThuVienSanPham` — thư viện tra cứu mã sản phẩm kèm ảnh (product master).
 * Module ĐỘC LẬP, KHÔNG nối vào lệnh/xếp lịch/tiến độ. Ảnh lưu trên Vercel Blob,
 * sheet chỉ giữ URL (cột AnhUrl).
 * Lưu ý: NguoiCapNhat đứng CUỐI vì sheet được tạo trước khi có cột này —
 * seed sẽ append cột thiếu vào cuối header (idempotent).
 */
export const THU_VIEN_SAN_PHAM_COLUMNS = [
  "MaSanPham",
  "TenSanPham",
  "KhachHang",
  "AnhUrl",
  "KhoThanhPham",
  "LoaiGiay",
  "GhiChu",
  "NgayCapNhat",
  "NguoiCapNhat",
] as const;

/** Bảng đăng ký 7 tab (dùng cho seed: tạo tab + ghi header đúng thứ tự). */
export const TAB_SCHEMAS: ReadonlyArray<{
  tab: string;
  columns: readonly string[];
}> = [
  { tab: "DonHang", columns: DON_HANG_COLUMNS },
  { tab: "LenhSanXuat", columns: LENH_SAN_XUAT_COLUMNS },
  { tab: "May", columns: MAY_COLUMNS },
  { tab: "LichChay", columns: LICH_CHAY_COLUMNS },
  { tab: "TienDo", columns: TIEN_DO_COLUMNS },
  { tab: "PhatSinh", columns: PHAT_SINH_COLUMNS },
  { tab: "NguoiDung", columns: NGUOI_DUNG_COLUMNS },
  { tab: "MaSanPham", columns: MA_SAN_PHAM_COLUMNS },
  { tab: "ThuVienSanPham", columns: THU_VIEN_SAN_PHAM_COLUMNS },
];

/**
 * Dữ liệu mẫu tab May (dùng đúng các số này để build & test logic xếp lịch).
 * Thay bằng số thật của xưởng sau — chỉ sửa dữ liệu, không sửa code.
 */
export const MAY_SEED_DATA: May[] = [
  {
    MaMay: "M01",
    TenMay: "Offset 4 màu #1",
    Loai: "InOffset",
    KhoToiDa: "52x74 cm",
    NangSuat: 8000,
    ThoiGianMakeReady: 40,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
  {
    MaMay: "M02",
    TenMay: "Offset 4 màu #2",
    Loai: "InOffset",
    KhoToiDa: "72x102 cm",
    NangSuat: 10000,
    ThoiGianMakeReady: 45,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
  {
    MaMay: "M03",
    TenMay: "Offset 1 màu",
    Loai: "InOffset",
    KhoToiDa: "52x74 cm",
    NangSuat: 6000,
    ThoiGianMakeReady: 25,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
  {
    MaMay: "M04",
    TenMay: "Máy cán màng",
    Loai: "CanMang",
    KhoToiDa: "76 cm",
    NangSuat: 2500,
    ThoiGianMakeReady: 15,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
  {
    MaMay: "M05",
    TenMay: "Máy bế tự động",
    Loai: "Be",
    KhoToiDa: "72x102 cm",
    NangSuat: 4000,
    ThoiGianMakeReady: 45,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
  {
    MaMay: "M06",
    TenMay: "Máy dán hộp",
    Loai: "Dan",
    KhoToiDa: "-",
    NangSuat: 8000,
    ThoiGianMakeReady: 30,
    TrangThai: "HoatDong",
    NguoiCapNhat: "seed",
    NgayCapNhat: "",
  },
];
