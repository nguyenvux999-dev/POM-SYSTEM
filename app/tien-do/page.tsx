import Link from "next/link";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import type { LichChay, TienDo } from "@/lib/domain/types";
import { treHan } from "@/lib/domain/assist";
import { parseLocal } from "@/lib/domain/datetime";
import { NHAN_CONG_DOAN } from "@/lib/domain/labels";
import { BadgeLenh } from "@/components/status-badge";
import { MaLenhHienThi } from "@/components/lenh-specs";

export const dynamic = "force-dynamic";

function moiNhatCongDoan(
  logs: TienDo[],
  congDoan: string,
): TienDo | undefined {
  const ds = logs.filter((t) => t.CongDoan === congDoan);
  if (ds.length === 0) return undefined;
  return ds.reduce((a, b) =>
    parseLocal(b.ThoiGian).getTime() >= parseLocal(a.ThoiGian).getTime() ? b : a,
  );
}

export default async function TienDoPage() {
  const [lenhList, donList, lichAll, tienDoAll] = await Promise.all([
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    lichChayRepository.findAll(),
    tienDoRepository.findAll(),
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

  const dangChay = lenhList
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
        current,
        latest,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        tre: treHan(ketThucCuoi || null, l.HanHoanThanh),
      };
    })
    .sort((a, b) =>
      (a.HanHoanThanh || "9999") < (b.HanHoanThanh || "9999") ? -1 : 1,
    );

  const soTre = dangChay.filter((x) => x.tre).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tiến độ sản xuất</h1>
        <p className="text-sm text-gray-500">
          Các lệnh đang trong sản xuất. Chạm một lệnh để cập nhật nhanh ngoài
          xưởng.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      <div className="space-y-2">
        {dangChay.map((x) => (
          <Link
            key={x.MaLenh}
            href={`/tien-do/${x.MaLenh}`}
            className={`block rounded-lg border bg-white p-3 hover:bg-gray-50 ${
              x.tre ? "border-red-300" : "border-gray-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <MaLenhHienThi maLenh={x.MaLenh} maLSXXuong={x.MaLSXXuong} />
              <BadgeLenh value={x.TrangThai} />
              {x.tre && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  ⚠️ Nguy cơ trễ
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {x.TenSanPham || "—"}{" "}
              <span className="text-xs font-normal text-gray-400">
                · {x.KhachHang}
              </span>
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${x.pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {x.done}/{x.total} công đoạn
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {x.current ? (
                <>
                  Hiện tại: <strong>{NHAN_CONG_DOAN[x.current.CongDoan]}</strong>
                  {x.latest
                    ? ` · đạt ${x.latest.SoLuongDat.toLocaleString()}/${x.SoToIn.toLocaleString()}`
                    : " · chưa bắt đầu"}
                </>
              ) : (
                "Đã xong tất cả công đoạn"
              )}{" "}
              · Hạn: {x.HanHoanThanh || "—"}
            </p>
          </Link>
        ))}
        {dangChay.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            Chưa có lệnh nào đang chạy. Hãy xếp lịch ở mục{" "}
            <Link href="/xep-lich" className="text-brand hover:underline">
              Xếp lịch
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
