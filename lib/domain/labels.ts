/** Nhãn hiển thị tiếng Việt cho các enum (dùng ở dropdown & badge). */

import type {
  CongDoan,
  DoUuTien,
  DonHangTrangThai,
  LenhTrangThai,
  TrangThaiFile,
} from "./enums";

export const NHAN_DON_HANG_TRANG_THAI: Record<DonHangTrangThai, string> = {
  Moi: "Mới",
  ChoCheBan: "Chờ chế bản",
  DaLenLich: "Đã lên lịch",
  DangSanXuat: "Đang sản xuất",
  HoanThanh: "Hoàn thành",
  TreHen: "Trễ hẹn",
  Huy: "Hủy",
};

export const NHAN_TRANG_THAI_FILE: Record<TrangThaiFile, string> = {
  ChoFile: "Chờ file",
  DangCheBan: "Đang chế bản",
  DaRaKem: "Đã ra kẽm",
  SanSang: "Sẵn sàng",
};

export const NHAN_DO_UU_TIEN: Record<DoUuTien, string> = {
  Thap: "Thấp",
  BinhThuong: "Bình thường",
  Cao: "Cao",
  Gap: "Gấp",
};

export const NHAN_LENH_TRANG_THAI: Record<LenhTrangThai, string> = {
  ChoLenLich: "Chờ lên lịch",
  DaLenLich: "Đã lên lịch",
  DangChay: "Đang chạy",
  HoanThanh: "Hoàn thành",
};

export const NHAN_CONG_DOAN: Record<CongDoan, string> = {
  In: "In",
  CanMang: "Cán màng",
  Be: "Bế",
  Dan: "Dán",
  DongGhim: "Đóng ghim",
  EpKim: "Ép kim",
  Khac: "Khác",
};
