/** Nhãn hiển thị tiếng Việt cho các enum (dùng ở dropdown & badge). */

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
  Cat: "Cắt",
  CanMang: "Cán màng",
  Be: "Bế",
  DucLo: "Đục lỗ",
  Dan: "Dán",
  Gap2: "Gấp 2",
  Gap3: "Gấp 3",
  Kiem: "Kiểm",
  DongSach: "Đóng sách",
  DongGhim: "Đóng ghim",
  EpKim: "Ép kim",
  Khac: "Khác",
};

export const NHAN_LICH_TRANG_THAI: Record<LichTrangThai, string> = {
  ChoChay: "Chờ chạy",
  DangChay: "Đang chạy",
  Xong: "Xong",
};

export const NHAN_MAY_LOAI: Record<MayLoai, string> = {
  InOffset: "In offset",
  CanMang: "Cán màng",
  Be: "Bế",
  Dan: "Dán",
  Khac: "Khác",
};

export const NHAN_MAY_TRANG_THAI: Record<MayTrangThai, string> = {
  HoatDong: "Hoạt động",
  BaoTri: "Bảo trì",
  Hong: "Hỏng",
};

export const NHAN_PHAT_SINH_LOAI: Record<PhatSinhLoai, string> = {
  MayHong: "Máy hỏng",
  GiayTre: "Giấy trễ",
  LechMau: "Lệch màu",
  DoiSoLuong: "Đổi số lượng",
  DonGap: "Đơn gấp",
  Khac: "Khác",
};

export const NHAN_MUC_DO: Record<MucDo, string> = {
  Nhe: "Nhẹ",
  TrungBinh: "Trung bình",
  NghiemTrong: "Nghiêm trọng",
};

export const NHAN_PHAT_SINH_TRANG_THAI: Record<PhatSinhTrangThai, string> = {
  Moi: "Mới",
  DangXuLy: "Đang xử lý",
  DaXong: "Đã xong",
};
