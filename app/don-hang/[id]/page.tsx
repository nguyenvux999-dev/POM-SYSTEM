import Link from "next/link";
import { notFound } from "next/navigation";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { coTheXepLich } from "@/lib/domain/gate";
import { NHAN_CONG_DOAN, NHAN_LENH_TRANG_THAI } from "@/lib/domain/labels";
import { BU_HAO_MAC_DINH_PHAN_TRAM } from "@/lib/domain/config";
import type { CongDoan } from "@/lib/domain/enums";
import {
  Badge,
  BadgeDonHang,
  BadgeFile,
  BadgeUuTien,
} from "@/components/status-badge";
import { MaLenhHienThi, ThongSoChips } from "@/components/lenh-specs";
import { LenhManager } from "./lenh-manager";

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

function congDoanList(raw: string): CongDoan[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter((s): s is CongDoan => s.length > 0);
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const don = await donHangRepository.findById(id);
  if (!don) notFound();

  const lenhList = await lenhSanXuatRepository.findByMaDon(id);

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

      {/* Lệnh sản xuất hiện có */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Lệnh sản xuất ({lenhList.length})
        </h2>
        {lenhList.length === 0 ? (
          <p className="text-sm text-gray-400">
            Chưa có lệnh. Tạo lệnh bên dưới (mặc định 1 lệnh, có thể thêm nhiều).
          </p>
        ) : (
          <div className="space-y-2">
            {lenhList.map((l) => (
              <div
                key={l.MaLenh}
                className="rounded-md border border-gray-200 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <MaLenhHienThi maLenh={l.MaLenh} maLSXXuong={l.MaLSXXuong} />
                  <BadgeFile value={l.TrangThaiFile} />
                  <BadgeUuTien value={l.DoUuTien} />
                  <Badge tone="gray">
                    {NHAN_LENH_TRANG_THAI[l.TrangThai]}
                  </Badge>
                  {coTheXepLich(l) && <Badge tone="green">Sẵn sàng xếp lịch</Badge>}
                </div>
                {l.MoTaCongViec && (
                  <p className="mt-1 text-sm text-gray-600">{l.MoTaCongViec}</p>
                )}
                {/* Thông số kỹ thuật: số màu/loại giấy từ đơn; khổ giấy/khổ in/số trang từ lệnh. */}
                <div className="mt-2">
                  <ThongSoChips
                    SoMau={don.SoMau}
                    LoaiGiay={don.LoaiGiay}
                    KhoGiay={l.KhoGiay}
                    KhoIn={l.KhoIn}
                    SoTrang={l.SoTrang}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {congDoanList(l.CongDoanCanLam).map((cd, i) => (
                    <span
                      key={`${cd}-${i}`}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {i + 1}. {NHAN_CONG_DOAN[cd] ?? cd}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {l.HanHoanThanh && <>Hạn hoàn thành: {l.HanHoanThanh} · </>}
                  Bù hao:{" "}
                  {l.BuHaoPhanTram && l.BuHaoPhanTram > 0
                    ? `${l.BuHaoPhanTram}%`
                    : `${BU_HAO_MAC_DINH_PHAN_TRAM}% (mặc định)`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tạo lệnh (1 → N) */}
      <LenhManager maDon={don.MaDon} />
    </div>
  );
}
