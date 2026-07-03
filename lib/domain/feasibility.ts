/**
 * 1.5 — Kiểm tra khả thi hạn giao (THUẦN, không import server-only).
 *
 *   tongPhutSanXuat  = Σ thời lượng các công đoạn
 *   soNgaySanXuat    = ceil(tongPhutSanXuat / 60 / GIO_LAM_VIEC_MOI_NGAY)
 *   tongNgayCanThiet = soNgaySanXuat + DEM_CHE_BAN_NGAY
 *                       + ceil(DEM_DONG_GOI_GIAO_GIO / GIO_LAM_VIEC_MOI_NGAY)
 *   soNgayConLai     = số ngày lịch từ hôm nay → NgayGiaoHang
 *   khaThi           = soNgayConLai >= tongNgayCanThiet
 *
 * Đây là CẢNH BÁO, không chặn tạo đơn (planner có thể vẫn nhận rồi thương lượng).
 */

import {
  DEM_CHE_BAN_NGAY,
  DEM_DONG_GOI_GIAO_GIO,
  GIO_LAM_VIEC_MOI_NGAY,
} from "./config";
import { soNgayGiua } from "./datetime";
import { uocTinhThoiLuongLenhPhut, type BangNangLuc } from "./estimate";

export interface KetQuaKhaThi {
  khaThi: boolean;
  tongPhutSanXuat: number;
  soNgaySanXuat: number;
  tongNgayCanThiet: number;
  /** NaN nếu ngày giao hàng không hợp lệ/không xác định. */
  soNgayConLai: number;
  /** Có thông điệp khi không khả thi hoặc thiếu dữ liệu để tính. */
  canhBao?: string;
}

export function kiemTraKhaThi(
  soLuong: number,
  congDoanCanLam: string[],
  ngayGiaoHang: string,
  bang: BangNangLuc,
  homNay: string,
): KetQuaKhaThi {
  const tongPhutSanXuat = uocTinhThoiLuongLenhPhut(
    soLuong,
    congDoanCanLam,
    bang,
  );
  const soNgaySanXuat = Math.ceil(
    tongPhutSanXuat / 60 / GIO_LAM_VIEC_MOI_NGAY,
  );
  const tongNgayCanThiet =
    soNgaySanXuat +
    DEM_CHE_BAN_NGAY +
    Math.ceil(DEM_DONG_GOI_GIAO_GIO / GIO_LAM_VIEC_MOI_NGAY);

  const soNgayConLai = soNgayGiua(homNay, ngayGiaoHang);

  if (Number.isNaN(soNgayConLai)) {
    return {
      khaThi: false,
      tongPhutSanXuat,
      soNgaySanXuat,
      tongNgayCanThiet,
      soNgayConLai,
      canhBao: "Chưa có ngày giao hàng hợp lệ để kiểm tra khả thi.",
    };
  }

  const khaThi = soNgayConLai >= tongNgayCanThiet;
  return {
    khaThi,
    tongPhutSanXuat,
    soNgaySanXuat,
    tongNgayCanThiet,
    soNgayConLai,
    canhBao: khaThi
      ? undefined
      : `Hạn giao quá gấp: cần ~${tongNgayCanThiet} ngày (gồm sản xuất ${soNgaySanXuat} ngày + đệm chế bản & đóng gói) nhưng chỉ còn ${soNgayConLai} ngày. Nên báo kinh doanh thương lượng lại hạn.`,
  };
}
