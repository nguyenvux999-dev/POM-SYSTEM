import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { maSanPhamRepository } from "@/lib/repositories/maSanPham";
import type { LichChay, MaSanPham, TienDo } from "@/lib/domain/types";
import { treHan } from "@/lib/domain/assist";
import { parseLocal } from "@/lib/domain/datetime";
import { chuoiTimKiemLenh, nhanMaSP } from "@/components/lenh-specs";
import { TienDoDanhSach, type TienDoItemVM } from "./danh-sach";

export const dynamic = "force-dynamic";

function moiNhatCongDoan(logs: TienDo[], congDoan: string): TienDo | undefined {
  const ds = logs.filter((t) => t.CongDoan === congDoan);
  if (ds.length === 0) return undefined;
  return ds.reduce((a, b) =>
    parseLocal(b.ThoiGian).getTime() >= parseLocal(a.ThoiGian).getTime()
      ? b
      : a,
  );
}

export default async function TienDoPage() {
  const [lenhList, donList, lichAll, tienDoAll, maSanPhamAll] =
    await Promise.all([
      lenhSanXuatRepository.findAll(),
      donHangRepository.findAll(),
      lichChayRepository.findAll(),
      tienDoRepository.findAll(),
      maSanPhamRepository.findAll(),
    ]);

  const donMap = new Map(donList.map((d) => [d.MaDon, d]));
  const lichByLenh = new Map<string, LichChay[]>();
  for (const l of lichAll) {
    const arr = lichByLenh.get(l.MaLenh) ?? [];
    arr.push(l);
    lichByLenh.set(l.MaLenh, arr);
  }
  const tienDoByLenh = new Map<string, TienDo[]>();
  for (const t of tienDoAll) {
    const arr = tienDoByLenh.get(t.MaLenh) ?? [];
    arr.push(t);
    tienDoByLenh.set(t.MaLenh, arr);
  }
  // Join MaSanPham theo MaLenh trong RAM (đọc cả tab 1 lần qua cache,
  // không gọi API theo từng lệnh).
  const maSPByLenh = new Map<string, MaSanPham[]>();
  for (const m of maSanPhamAll) {
    const arr = maSPByLenh.get(m.MaLenh) ?? [];
    arr.push(m);
    maSPByLenh.set(m.MaLenh, arr);
  }

  const dangChay: TienDoItemVM[] = lenhList
    .filter((l) => l.TrangThai === "DaLenLich" || l.TrangThai === "DangChay")
    .map((l) => {
      const d = donMap.get(l.MaDon);
      const stages = (lichByLenh.get(l.MaLenh) ?? [])
        .slice()
        .sort((a, b) => (a.BatDauDuKien < b.BatDauDuKien ? -1 : 1));
      const total = stages.length;
      const done = stages.filter((s) => s.TrangThai === "Xong").length;
      const current = stages.find((s) => s.TrangThai !== "Xong");
      const ketThucCuoi = stages.reduce(
        (m, k) => (k.KetThucDuKien > m ? k.KetThucDuKien : m),
        "",
      );
      const logs = tienDoByLenh.get(l.MaLenh) ?? [];
      const latest = current
        ? moiNhatCongDoan(logs, current.CongDoan)
        : undefined;
      const maSP = maSPByLenh.get(l.MaLenh) ?? [];
      return {
        MaLenh: l.MaLenh,
        MaLSXXuong: l.MaLSXXuong ?? "",
        TrangThai: l.TrangThai,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
        // Mục tiêu tiến độ = số tờ in của lệnh (mẻ chạy máy).
        SoToIn: l.SoToIn ?? 0,
        HanHoanThanh: l.HanHoanThanh,
        total,
        done,
        congDoanHienTai: current?.CongDoan,
        soLuongDat: latest?.SoLuongDat,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        tre: treHan(ketThucCuoi || null, l.HanHoanThanh),
        MaSP: nhanMaSP(maSP),
        TimKiem: chuoiTimKiemLenh({
          tenSanPham: d?.TenSanPham,
          maLenh: l.MaLenh,
          maLSXXuong: l.MaLSXXuong,
          maSP,
        }),
      };
    })
    .sort((a, b) =>
      (a.HanHoanThanh || "9999") < (b.HanHoanThanh || "9999") ? -1 : 1,
    );

  const soTre = dangChay.filter((x) => x.tre).length;

  return (
    // Tiêu đề + thẻ thống kê + ô tìm cố định; danh sách lệnh là vùng cuộn.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">Tiến độ sản xuất</h1>
        <p className="text-sm text-gray-500">
          Các lệnh đang trong sản xuất. Chạm một lệnh để cập nhật nhanh ngoài
          xưởng.
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold text-gray-900">
            {dangChay.length}
          </div>
          <div className="text-xs text-gray-500">Lệnh đang chạy</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-2xl font-semibold text-gray-900">
            {dangChay.filter((x) => x.total > 0 && x.done === x.total).length}
          </div>
          <div className="text-xs text-gray-500">Đã xong công đoạn cuối</div>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            soTre > 0 ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
          }`}
        >
          <div
            className={`text-2xl font-semibold ${
              soTre > 0 ? "text-red-700" : "text-gray-900"
            }`}
          >
            {soTre}
          </div>
          <div className="text-xs text-gray-500">Nguy cơ trễ hạn</div>
        </div>
      </div>

      <TienDoDanhSach items={dangChay} />
    </div>
  );
}
