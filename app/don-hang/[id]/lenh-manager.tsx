"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONG_DOAN, DO_UU_TIEN, type DoUuTien } from "@/lib/domain/enums";
import { NHAN_CONG_DOAN, NHAN_DO_UU_TIEN } from "@/lib/domain/labels";
import { BU_HAO_MAC_DINH_PHAN_TRAM } from "@/lib/domain/config";
import type { LenhDraftInput, MaSanPhamInput } from "@/lib/domain/inputs";
import { taoLenh } from "../actions";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelCls = "block text-sm font-medium text-gray-700";

/** Parse ô số tùy chọn: rỗng → undefined; số hợp lệ → number; ngược lại → undefined. */
function parseOptionalNum(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function lenhMoi(): LenhDraftInput {
  return {
    MoTaCongViec: "",
    CongDoanCanLam: ["In"],
    DoUuTien: "BinhThuong",
    HanHoanThanh: "",
    MaLSXXuong: "",
    SoTrang: undefined,
    KhoGiay: "",
    KhoIn: "",
    BuHaoPhanTram: BU_HAO_MAC_DINH_PHAN_TRAM,
    SoToIn: undefined,
  };
}

function maSPMoi(): MaSanPhamInput {
  return { MaSanPham: "", TenSanPham: "", KichThuoc: "", SoLuong: 0 };
}

export function LenhManager({ maDon }: { maDon: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lenh, setLenh] = useState<LenhDraftInput>(lenhMoi());
  const [maSP, setMaSP] = useState<MaSanPhamInput[]>([maSPMoi()]);

  const set = <K extends keyof LenhDraftInput>(k: K, v: LenhDraftInput[K]) =>
    setLenh((d) => ({ ...d, [k]: v }));

  const toggleCongDoan = (cd: string) =>
    setLenh((d) => ({
      ...d,
      CongDoanCanLam: d.CongDoanCanLam.includes(cd)
        ? d.CongDoanCanLam.filter((c) => c !== cd)
        : [...d.CongDoanCanLam, cd],
    }));

  const setMa = (idx: number, patch: Partial<MaSanPhamInput>) =>
    setMaSP((cur) => cur.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const themMa = () => setMaSP((cur) => [...cur, maSPMoi()]);
  const xoaMa = (idx: number) =>
    setMaSP((cur) => (cur.length > 1 ? cur.filter((_, i) => i !== idx) : cur));

  function luu() {
    setError(null);
    if (lenh.CongDoanCanLam.length === 0) {
      setError("Lệnh cần chọn ít nhất 1 công đoạn.");
      return;
    }
    if (!(Number(lenh.SoToIn) > 0)) {
      setError("Cần nhập Số tờ in (> 0) để tính được thời lượng.");
      return;
    }
    const dsMa = maSP.filter(
      (m) => m.MaSanPham.trim() || m.TenSanPham.trim(),
    );
    if (dsMa.length === 0) {
      setError("Cần ít nhất 1 mã sản phẩm trong lệnh.");
      return;
    }
    startTransition(async () => {
      const res = await taoLenh(maDon, lenh, dsMa);
      if (res.ok) {
        setLenh(lenhMoi());
        setMaSP([maSPMoi()]);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Tạo lệnh sản xuất (mỗi đơn 1 lệnh)
      </h2>

      {/* Thông tin lệnh */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Mô tả công việc</label>
          <input
            className={inputCls}
            value={lenh.MoTaCongViec}
            onChange={(e) => set("MoTaCongViec", e.target.value)}
            placeholder="Vd: In + gia công ghép nhiều mã"
          />
        </div>
        <div>
          <label className={labelCls}>Độ ưu tiên</label>
          <select
            className={inputCls}
            value={lenh.DoUuTien}
            onChange={(e) => set("DoUuTien", e.target.value as DoUuTien)}
          >
            {DO_UU_TIEN.map((p) => (
              <option key={p} value={p}>
                {NHAN_DO_UU_TIEN[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hạn hoàn thành</label>
          <input
            type="date"
            className={inputCls}
            value={lenh.HanHoanThanh}
            onChange={(e) => set("HanHoanThanh", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>
            Số tờ in <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className={inputCls}
            value={lenh.SoToIn ?? ""}
            onChange={(e) => set("SoToIn", parseOptionalNum(e.target.value))}
            placeholder="Số tờ chạy máy của mẻ"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Nhiều mã in ghép trên 1 tờ → KHÁC tổng SL các mã. Dùng để tính thời lượng.
          </p>
        </div>
      </div>

      {/* Thông số sản xuất (tùy chọn) */}
      <div className="mt-3 rounded-md border border-dashed border-gray-200 p-3">
        <p className="mb-2 text-xs font-medium text-gray-500">
          Thông số sản xuất (tùy chọn)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Mã LSX xưởng</label>
            <input
              className={inputCls}
              value={lenh.MaLSXXuong ?? ""}
              onChange={(e) => set("MaLSXXuong", e.target.value)}
              placeholder="Bỏ trống nếu dùng mã hệ thống"
            />
          </div>
          <div>
            <label className={labelCls}>Khổ giấy</label>
            <input
              className={inputCls}
              value={lenh.KhoGiay ?? ""}
              onChange={(e) => set("KhoGiay", e.target.value)}
              placeholder="Vd: 700x965mm"
            />
          </div>
          <div>
            <label className={labelCls}>Khổ in</label>
            <input
              className={inputCls}
              value={lenh.KhoIn ?? ""}
              onChange={(e) => set("KhoIn", e.target.value)}
              placeholder="Vd: 700x475mm"
            />
          </div>
          <div>
            <label className={labelCls}>Số trang</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              value={lenh.SoTrang ?? ""}
              onChange={(e) => set("SoTrang", parseOptionalNum(e.target.value))}
              placeholder="Cho sản phẩm sách"
            />
          </div>
          <div>
            <label className={labelCls}>Bù hao (%)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              className={inputCls}
              value={lenh.BuHaoPhanTram ?? ""}
              onChange={(e) =>
                set("BuHaoPhanTram", parseOptionalNum(e.target.value))
              }
              placeholder={`Mặc định ${BU_HAO_MAC_DINH_PHAN_TRAM}%`}
            />
          </div>
        </div>
      </div>

      {/* Công đoạn */}
      <div className="mt-3">
        <label className={labelCls}>Công đoạn cần làm (theo thứ tự chọn)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONG_DOAN.map((cd) => {
            const order = lenh.CongDoanCanLam.indexOf(cd);
            const active = order >= 0;
            return (
              <button
                type="button"
                key={cd}
                onClick={() => toggleCongDoan(cd)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-gray-300 bg-white text-gray-600"
                }`}
              >
                {active ? `${order + 1}. ` : ""}
                {NHAN_CONG_DOAN[cd]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mã sản phẩm trong lệnh */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className={labelCls}>Mã sản phẩm trong lệnh (in ghép chung)</label>
          <button
            type="button"
            onClick={themMa}
            className="rounded-md border border-brand px-3 py-1 text-xs text-brand hover:bg-blue-50"
          >
            ＋ Thêm mã
          </button>
        </div>
        <div className="space-y-2">
          {maSP.map((m, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-2 sm:grid-cols-[1fr_1fr_7rem_6rem_auto]"
            >
              <input
                className={inputCls}
                value={m.MaSanPham}
                onChange={(e) => setMa(idx, { MaSanPham: e.target.value })}
                placeholder="Mã SP (vd S20S01724)"
              />
              <input
                className={inputCls}
                value={m.TenSanPham}
                onChange={(e) => setMa(idx, { TenSanPham: e.target.value })}
                placeholder="Tên sản phẩm"
              />
              <input
                className={inputCls}
                value={m.KichThuoc}
                onChange={(e) => setMa(idx, { KichThuoc: e.target.value })}
                placeholder="Kích thước"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputCls}
                value={m.SoLuong || ""}
                onChange={(e) =>
                  setMa(idx, { SoLuong: parseOptionalNum(e.target.value) ?? 0 })
                }
                placeholder="SL"
              />
              <button
                type="button"
                onClick={() => xoaMa(idx)}
                disabled={maSP.length <= 1}
                className="rounded-md border border-gray-300 px-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                aria-label="Xóa mã"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          SL ở đây là số THÀNH PHẨM của từng mã (mô tả) — không dùng để tính thời lượng.
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={luu}
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Đang lưu…" : 'Lưu lệnh & chuyển "Chờ chế bản"'}
        </button>
      </div>
    </div>
  );
}
