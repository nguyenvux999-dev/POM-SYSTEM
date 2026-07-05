/**
 * Enums (khai báo dạng const array + union type).
 *
 * Mỗi enum có:
 *  - Một mảng `const` chứa toàn bộ giá trị hợp lệ (dùng để validate & render dropdown).
 *  - Một union type suy ra từ mảng đó (dùng cho types.ts).
 *
 * Quy ước: giá trị lưu trong Google Sheets đúng bằng chuỗi trong mảng.
 */

// --- DonHang ---
export const DON_HANG_TRANG_THAI = [
  "Moi",
  "ChoCheBan",
  "DaLenLich",
  "DangSanXuat",
  "HoanThanh",
  "TreHen",
  "Huy",
] as const;
export type DonHangTrangThai = (typeof DON_HANG_TRANG_THAI)[number];

// --- LenhSanXuat: trạng thái file (chế bản) ---
export const TRANG_THAI_FILE = [
  "ChoFile",
  "DangCheBan",
  "DaRaKem",
  "SanSang",
] as const;
export type TrangThaiFile = (typeof TRANG_THAI_FILE)[number];

// --- LenhSanXuat: độ ưu tiên ---
export const DO_UU_TIEN = ["Thap", "BinhThuong", "Cao", "Gap"] as const;
export type DoUuTien = (typeof DO_UU_TIEN)[number];

// --- LenhSanXuat: trạng thái lệnh ---
export const LENH_TRANG_THAI = [
  "ChoLenLich",
  "DaLenLich",
  "DangChay",
  "HoanThanh",
] as const;
export type LenhTrangThai = (typeof LENH_TRANG_THAI)[number];

// --- May: loại máy ---
export const MAY_LOAI = [
  "InOffset",
  "CanMang",
  "Be",
  "Dan",
  "Khac",
] as const;
export type MayLoai = (typeof MAY_LOAI)[number];

// --- May: trạng thái máy ---
export const MAY_TRANG_THAI = ["HoatDong", "BaoTri", "Hong"] as const;
export type MayTrangThai = (typeof MAY_TRANG_THAI)[number];

// --- Công đoạn sản xuất (dùng chung cho LichChay, TienDo) ---
// Thứ tự = thứ tự hiển thị trong bộ chọn công đoạn (theo luồng sản xuất của xưởng).
export const CONG_DOAN = [
  "In",
  "Cat",
  "CanMang",
  "Be",
  "DucLo",
  "Dan",
  "Gap2",
  "Gap3",
  "Kiem",
  "DongSach",
  // Công đoạn cũ — GIỮ LẠI để dữ liệu cũ vẫn đọc/hiển thị bình thường
  // (không nằm trong danh sách xưởng mới nhưng có thể còn ở lệnh đã tạo).
  "DongGhim",
  "EpKim",
  "Khac",
] as const;
export type CongDoan = (typeof CONG_DOAN)[number];

// --- LichChay: trạng thái ---
export const LICH_TRANG_THAI = ["ChoChay", "DangChay", "Xong"] as const;
export type LichTrangThai = (typeof LICH_TRANG_THAI)[number];

// --- PhatSinh: loại sự cố ---
export const PHAT_SINH_LOAI = [
  "MayHong",
  "GiayTre",
  "LechMau",
  "DoiSoLuong",
  "DonGap",
  "Khac",
] as const;
export type PhatSinhLoai = (typeof PHAT_SINH_LOAI)[number];

// --- PhatSinh: mức độ ---
export const MUC_DO = ["Nhe", "TrungBinh", "NghiemTrong"] as const;
export type MucDo = (typeof MUC_DO)[number];

// --- PhatSinh: trạng thái xử lý ---
export const PHAT_SINH_TRANG_THAI = ["Moi", "DangXuLy", "DaXong"] as const;
export type PhatSinhTrangThai = (typeof PHAT_SINH_TRANG_THAI)[number];

// --- NguoiDung: vai trò ---
export const VAI_TRO = [
  "Admin",
  "Planner",
  "KinhDoanh",
  "CheBan",
  "ToTruong",
  "Xem",
] as const;
export type VaiTro = (typeof VAI_TRO)[number];
