import { mayRepository } from "@/lib/repositories/may";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { formatLocal, nowLocal } from "@/lib/domain/datetime";
import { Board, type ChoXepVM, type LichVM } from "./board";

export const dynamic = "force-dynamic";

export default async function XepLichPage() {
  const [may, lenhList, donList, lichList] = await Promise.all([
    mayRepository.findAll(),
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    lichChayRepository.findAll(),
  ]);

  const donMap = new Map(donList.map((d) => [d.MaDon, d]));
  const lenhMap = new Map(lenhList.map((l) => [l.MaLenh, l]));

  // 2.3 — Lệnh chờ xếp: chỉ SanSang + ChoLenLich (sắp xếp cuối cùng ở client).
  const choXep: ChoXepVM[] = lenhList
    .filter((l) => l.TrangThaiFile === "SanSang" && l.TrangThai === "ChoLenLich")
    .map((l) => {
      const d = donMap.get(l.MaDon);
      return {
        MaLenh: l.MaLenh,
        MaDon: l.MaDon,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
        HanHoanThanh: l.HanHoanThanh,
        DoUuTien: l.DoUuTien,
        CongDoanCanLam: l.CongDoanCanLam,
        SoLuong: d?.SoLuong ?? 0,
        SoMau: d?.SoMau ?? "",
        LoaiGiay: d?.LoaiGiay ?? "",
        KhoThanhPham: d?.KhoThanhPham ?? "",
      };
    });

  // Lịch đã chốt, join lệnh + đơn để hiển thị + tính trợ lý.
  const lich: LichVM[] = lichList.map((l) => {
    const lenh = lenhMap.get(l.MaLenh);
    const d = lenh ? donMap.get(lenh.MaDon) : undefined;
    return {
      ...l,
      TenSanPham: d?.TenSanPham ?? "",
      KhachHang: d?.KhachHang ?? "",
      HanHoanThanh: lenh?.HanHoanThanh ?? "",
      DoUuTien: lenh?.DoUuTien ?? "BinhThuong",
      SoMau: d?.SoMau ?? "",
      LoaiGiay: d?.LoaiGiay ?? "",
      KhoThanhPham: d?.KhoThanhPham ?? "",
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Xếp lịch</h1>
        <p className="text-sm text-gray-500">
          Gán lệnh <strong>đã Sẵn sàng</strong> lên máy — hệ thống tự tính giờ
          bắt đầu/kết thúc và cảnh báo trễ hạn, gom màu/khổ, tải máy. Bạn vẫn là
          người quyết định.
        </p>
      </div>
      <Board
        may={may}
        lich={lich}
        choXep={choXep}
        now={formatLocal(nowLocal())}
      />
    </div>
  );
}
