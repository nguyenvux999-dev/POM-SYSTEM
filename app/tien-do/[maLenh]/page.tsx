import Link from "next/link";
import { notFound } from "next/navigation";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { parseLocal } from "@/lib/domain/datetime";
import { BadgeLenh } from "@/components/status-badge";
import { MaLenhHienThi } from "@/components/lenh-specs";
import { ProgressPanel, type StageVM } from "./update-form";

export const dynamic = "force-dynamic";

export default async function TienDoLenhPage({
  params,
}: {
  params: Promise<{ maLenh: string }>;
}) {
  const { maLenh } = await params;
  const lenh = await lenhSanXuatRepository.findById(maLenh);
  if (!lenh) notFound();

  const [don, lichRows, logs] = await Promise.all([
    donHangRepository.findById(lenh.MaDon),
    lichChayRepository.findByLenh(maLenh),
    tienDoRepository.findByLenh(maLenh),
  ]);

  // Mục tiêu tiến độ của lệnh = số tờ in của mẻ (không phải SL đơn/mã SP).
  const soLuong = lenh.SoToIn ?? 0;

  const stages: StageVM[] = lichRows
    .slice()
    .sort((a, b) => (a.BatDauDuKien < b.BatDauDuKien ? -1 : 1))
    .map((l) => {
      const cua = logs.filter((t) => t.CongDoan === l.CongDoan);
      const latest =
        cua.length > 0
          ? cua.reduce((a, b) =>
              parseLocal(b.ThoiGian).getTime() >= parseLocal(a.ThoiGian).getTime()
                ? b
                : a,
            )
          : undefined;
      return {
        MaLich: l.MaLich,
        CongDoan: l.CongDoan,
        MaMay: l.MaMay,
        TrangThai: l.TrangThai,
        BatDauDuKien: l.BatDauDuKien,
        KetThucDuKien: l.KetThucDuKien,
        SoLuongDat: latest?.SoLuongDat ?? 0,
      };
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="leading-tight">
            <MaLenhHienThi
              maLenh={lenh.MaLenh}
              maLSXXuong={lenh.MaLSXXuong}
              size="lg"
              bold
            />
          </h1>
          <p className="text-sm text-gray-500">
            {don?.TenSanPham ?? ""} · {don?.KhachHang ?? ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/tien-do" className="text-sm text-brand hover:underline">
            ← Danh sách
          </Link>
          <Link
            href={`/phat-sinh/new?maLenh=${encodeURIComponent(maLenh)}`}
            className="text-sm text-amber-700 hover:underline"
          >
            ⚠️ Ghi phát sinh
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <BadgeLenh value={lenh.TrangThai} />
        <span className="text-gray-500">
          Số lượng: <strong>{soLuong.toLocaleString()}</strong>
        </span>
        <span className="text-gray-500">
          Hạn: <strong>{lenh.HanHoanThanh || "—"}</strong>
        </span>
      </div>

      <ProgressPanel maLenh={maLenh} soLuong={soLuong} stages={stages} />
    </div>
  );
}
