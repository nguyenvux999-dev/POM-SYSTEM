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
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Chế bản</h1>
        <p className="text-sm text-gray-500">
          Cập nhật trạng thái file của từng lệnh. Lệnh ở cột{" "}
          <strong>Sẵn sàng</strong> mới được đưa vào xếp lịch.
        </p>
      </div>
      <Kanban cards={cards} />
    </div>
  );
}
