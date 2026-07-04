import Link from "next/link";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { mayRepository } from "@/lib/repositories/may";
import {
  PhatSinhForm,
  type LenhOption,
  type MayOption,
} from "./phat-sinh-form";

export const dynamic = "force-dynamic";

export default async function NewPhatSinhPage({
  searchParams,
}: {
  searchParams: Promise<{ maLenh?: string }>;
}) {
  const { maLenh } = await searchParams;

  const [lenhList, donList, mayList] = await Promise.all([
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    mayRepository.findAll(),
  ]);
  const donMap = new Map(donList.map((d) => [d.MaDon, d]));

  // Chọn từ các lệnh chưa hoàn thành (đang chạy / đã lên lịch / chờ lên lịch).
  const lenhOptions: LenhOption[] = lenhList
    .filter((l) => l.TrangThai !== "HoanThanh")
    .map((l) => {
      const d = donMap.get(l.MaDon);
      return {
        MaLenh: l.MaLenh,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
      };
    });

  const mayOptions: MayOption[] = mayList.map((m) => ({
    MaMay: m.MaMay,
    TenMay: m.TenMay,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ghi phát sinh</h1>
        <Link href="/phat-sinh" className="text-sm text-brand hover:underline">
          ← Cần xử lý
        </Link>
      </div>
      <PhatSinhForm
        lenhOptions={lenhOptions}
        mayOptions={mayOptions}
        maLenhMacDinh={maLenh ?? ""}
      />
    </div>
  );
}
