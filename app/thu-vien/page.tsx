import { thuVienSanPhamRepository } from "@/lib/repositories/thuVienSanPham";
import { ThuVienClient } from "./thu-vien-client";

export const dynamic = "force-dynamic";

/**
 * Thư viện sản phẩm — module TRA CỨU độc lập (mã + ảnh + thông số cơ bản).
 * KHÔNG nối vào lệnh sản xuất/xếp lịch. Đọc cả tab một lần, tìm kiếm lọc
 * trong RAM ở client (không gọi API mỗi lần gõ).
 */
export default async function ThuVienPage() {
  const ds = await thuVienSanPhamRepository.findAll();
  return <ThuVienClient dsBanDau={ds} />;
}
