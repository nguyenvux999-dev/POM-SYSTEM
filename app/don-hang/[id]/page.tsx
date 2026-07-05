import Link from "next/link";
import { notFound } from "next/navigation";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { moiLichDaXong, quyenSuaXoaLenh } from "@/lib/domain/gate";
import type { LichChay } from "@/lib/domain/types";
import { BadgeDonHang } from "@/components/status-badge";
import { LenhManager } from "./lenh-manager";
import { LenhList, type LenhCardVM } from "./lenh-list";

export const dynamic = "force-dynamic";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">
        {value || "—"}
      </span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [don, lenhList, lichAll, tienDoAll] = await Promise.all([
    donHangRepository.findById(id),
    lenhSanXuatRepository.findByMaDon(id),
    lichChayRepository.findAll(),
    tienDoRepository.findAll(),
  ]);
  if (!don) notFound();

  // Nhóm dữ liệu con theo lệnh để tính QUYỀN sửa/xóa (theo sự thật, không tin cột).
  const lichByLenh = new Map<string, LichChay[]>();
  for (const l of lichAll) {
    const arr = lichByLenh.get(l.MaLenh) ?? [];
    arr.push(l);
    lichByLenh.set(l.MaLenh, arr);
  }
  const coTienDoSet = new Set(tienDoAll.map((t) => t.MaLenh));

  const lenhVMs: LenhCardVM[] = lenhList.map((l) => {
    const lich = lichByLenh.get(l.MaLenh) ?? [];
    return {
      MaLenh: l.MaLenh,
      MaLSXXuong: l.MaLSXXuong ?? "",
      MoTaCongViec: l.MoTaCongViec,
      CongDoanCanLam: l.CongDoanCanLam,
      DoUuTien: l.DoUuTien,
      HanHoanThanh: l.HanHoanThanh,
      SoTrang: l.SoTrang ?? 0,
      KhoGiay: l.KhoGiay ?? "",
      KhoIn: l.KhoIn ?? "",
      BuHaoPhanTram: l.BuHaoPhanTram ?? 0,
      TrangThaiFile: l.TrangThaiFile,
      TrangThai: l.TrangThai,
      quyen: quyenSuaXoaLenh({
        trangThai: l.TrangThai,
        coLichChay: lich.length > 0,
        coTienDo: coTienDoSet.has(l.MaLenh),
        moiLichXong: moiLichDaXong(lich),
      }),
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{don.MaDon}</h1>
          <p className="text-sm text-gray-500">{don.TenSanPham}</p>
        </div>
        <Link href="/don-hang" className="text-sm text-brand hover:underline">
          ← Danh sách đơn
        </Link>
      </div>

      {/* Thông tin đơn */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            Thông tin đơn
          </span>
          <BadgeDonHang value={don.TrangThai} />
        </div>
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div>
            <InfoRow label="Khách hàng" value={don.KhachHang} />
            <InfoRow label="NV kinh doanh" value={don.NVKinhDoanh} />
            <InfoRow label="Số lượng" value={don.SoLuong.toLocaleString()} />
            <InfoRow label="Khổ thành phẩm" value={don.KhoThanhPham} />
            <InfoRow label="Loại giấy" value={don.LoaiGiay} />
          </div>
          <div>
            <InfoRow label="Số màu" value={don.SoMau} />
            <InfoRow label="Gia công sau in" value={don.GiaCongSauIn} />
            <InfoRow label="Ngày nhận" value={don.NgayNhan} />
            <InfoRow label="Ngày giao hàng" value={don.NgayGiaoHang} />
            <InfoRow label="Ghi chú" value={don.GhiChu} />
          </div>
        </div>
      </div>

      {/* Lệnh sản xuất hiện có — có Sửa/Xóa theo quy tắc trạng thái */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Lệnh sản xuất ({lenhVMs.length})
        </h2>
        <LenhList
          lenhs={lenhVMs}
          don={{ SoMau: don.SoMau, LoaiGiay: don.LoaiGiay }}
        />
      </div>

      {/* Tạo lệnh (1 → N) */}
      <LenhManager maDon={don.MaDon} />
    </div>
  );
}
