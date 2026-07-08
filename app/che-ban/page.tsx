import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { Kanban, type TheLenh } from "./kanban";

export const dynamic = "force-dynamic";

export default async function CheBanPage() {
  const [lenhList, donList] = await Promise.all([
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
  ]);
  const donMap = new Map(donList.map((d) => [d.MaDon, d]));

  const cards: TheLenh[] = lenhList.map((l) => {
    const d = donMap.get(l.MaDon);
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
