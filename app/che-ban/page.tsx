import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { maSanPhamRepository } from "@/lib/repositories/maSanPham";
import type { MaSanPham } from "@/lib/domain/types";
import { chuoiTimKiemLenh, nhanMaSP } from "@/components/lenh-specs";
import { Kanban, type TheLenh } from "./kanban";

export const dynamic = "force-dynamic";

export default async function CheBanPage() {
  const [lenhList, donList, maSanPhamAll] = await Promise.all([
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    maSanPhamRepository.findAll(),
  ]);
  const donMap = new Map(donList.map((d) => [d.MaDon, d]));
  // Join MaSanPham theo MaLenh trong RAM (đọc cả tab 1 lần qua cache,
  // không gọi API theo từng lệnh).
  const maSPByLenh = new Map<string, MaSanPham[]>();
  for (const m of maSanPhamAll) {
    const arr = maSPByLenh.get(m.MaLenh) ?? [];
    arr.push(m);
    maSPByLenh.set(m.MaLenh, arr);
  }

  const cards: TheLenh[] = lenhList.map((l) => {
    const d = donMap.get(l.MaDon);
    const maSP = maSPByLenh.get(l.MaLenh) ?? [];
    return {
      MaLenh: l.MaLenh,
      MaDon: l.MaDon,
      TrangThaiFile: l.TrangThaiFile,
      DoUuTien: l.DoUuTien,
      TenSanPham: d?.TenSanPham ?? "",
      KhachHang: d?.KhachHang ?? "",
      HanHoanThanh: l.HanHoanThanh,
      MaLSXXuong: l.MaLSXXuong ?? "",
      SoMau: d?.SoMau ?? "",
      LoaiGiay: d?.LoaiGiay ?? "",
      KhoGiay: l.KhoGiay ?? "",
      KhoIn: l.KhoIn ?? "",
      SoTrang: l.SoTrang ?? 0,
      MaSP: nhanMaSP(maSP),
      TimKiem: chuoiTimKiemLenh({
        tenSanPham: d?.TenSanPham,
        maLenh: l.MaLenh,
        maLSXXuong: l.MaLSXXuong,
        maSP,
      }),
    };
  });

  return (
    // Tiêu đề cố định; kanban chiếm phần còn lại và tự quản lý cuộn theo cột.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">Chế bản</h1>
        <p className="text-sm text-gray-500">
          Cập nhật trạng thái file của từng lệnh. Lệnh ở cột{" "}
          <strong>Sẵn sàng</strong> mới được đưa vào xếp lịch.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <Kanban cards={cards} />
      </div>
    </div>
  );
}
