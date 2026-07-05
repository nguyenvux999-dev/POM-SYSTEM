"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MUC_DO,
  PHAT_SINH_LOAI,
  type MayTrangThai,
  type MucDo,
  type PhatSinhLoai,
} from "@/lib/domain/enums";
import {
  NHAN_MUC_DO,
  NHAN_PHAT_SINH_LOAI,
} from "@/lib/domain/labels";
import type { PhatSinhInput } from "@/lib/domain/inputs";
import { ghiPhatSinh } from "../actions";

export interface LenhOption {
  MaLenh: string;
  MaLSXXuong: string;
  TenSanPham: string;
  KhachHang: string;
}

/** Nhãn option: ưu tiên mã xưởng (kèm MaLenh trong ngoặc) nếu có. */
function nhanLenh(l: LenhOption): string {
  const ma = l.MaLSXXuong.trim() ? `${l.MaLSXXuong} (${l.MaLenh})` : l.MaLenh;
  return `${ma} · ${l.TenSanPham} (${l.KhachHang})`;
}
export interface MayOption {
  MaMay: string;
  TenMay: string;
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelCls = "block text-sm font-medium text-gray-700";

export function PhatSinhForm({
  lenhOptions,
  mayOptions,
  maLenhMacDinh,
}: {
  lenhOptions: LenhOption[];
  mayOptions: MayOption[];
  maLenhMacDinh: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [maLenh, setMaLenh] = useState(maLenhMacDinh);
  const [loai, setLoai] = useState<PhatSinhLoai>("LechMau");
  const [mucDo, setMucDo] = useState<MucDo>("TrungBinh");
  const [anhHuong, setAnhHuong] = useState(false);
  const [moTa, setMoTa] = useState("");
  const [huongXuLy, setHuongXuLy] = useState("");
  const [maMay, setMaMay] = useState("");
  const [mayTT, setMayTT] = useState<"KhongDoi" | MayTrangThai>("Hong");

  function submit() {
    setError(null);
    if (!maLenh) return setError("Vui lòng chọn lệnh liên quan.");
    if (!moTa.trim()) return setError("Vui lòng nhập mô tả sự cố.");

    const input: PhatSinhInput = {
      MaLenh: maLenh,
      Loai: loai,
      MoTa: moTa.trim(),
      MucDo: mucDo,
      AnhHuongTienDo: anhHuong,
      HuongXuLy: huongXuLy.trim(),
    };
    const mayApDung = loai === "MayHong" && maMay ? maMay : undefined;
    const ttApDung =
      loai === "MayHong" && maMay && mayTT !== "KhongDoi" ? mayTT : undefined;

    startTransition(async () => {
      const res = await ghiPhatSinh(input, mayApDung, ttApDung);
      if (res.ok) router.push("/phat-sinh");
      else setError(res.error);
    });
  }

  const toggleBtn = (active: boolean) =>
    `rounded-lg border-2 px-4 py-3 text-sm font-semibold ${
      active ? "border-brand bg-blue-50 text-brand" : "border-gray-200 bg-white text-gray-600"
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className={labelCls}>
            Lệnh liên quan <span className="text-red-600">*</span>
          </label>
          <select
            className={inputCls}
            value={maLenh}
            onChange={(e) => setMaLenh(e.target.value)}
          >
            <option value="">— Chọn lệnh —</option>
            {lenhOptions.map((l) => (
              <option key={l.MaLenh} value={l.MaLenh}>
                {nhanLenh(l)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Loại sự cố</label>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PHAT_SINH_LOAI.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setLoai(v)}
                className={toggleBtn(loai === v)}
              >
                {NHAN_PHAT_SINH_LOAI[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Máy hỏng → chọn máy + đặt trạng thái máy */}
        {loai === "MayHong" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <label className={labelCls}>Máy bị ảnh hưởng</label>
            <select
              className={inputCls}
              value={maMay}
              onChange={(e) => setMaMay(e.target.value)}
            >
              <option value="">— Chọn máy —</option>
              {mayOptions.map((m) => (
                <option key={m.MaMay} value={m.MaMay}>
                  {m.MaMay} · {m.TenMay}
                </option>
              ))}
            </select>
            <div>
              <label className={labelCls}>Đặt trạng thái máy</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["KhongDoi", "BaoTri", "Hong"] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setMayTT(v)}
                    className={toggleBtn(mayTT === v)}
                  >
                    {v === "KhongDoi" ? "Không đổi" : v === "BaoTri" ? "Bảo trì" : "Hỏng"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Mức độ</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {MUC_DO.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setMucDo(v)}
                className={toggleBtn(mucDo === v)}
              >
                {NHAN_MUC_DO[v]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Ảnh hưởng tiến độ giao hàng?</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAnhHuong(false)}
              className={toggleBtn(!anhHuong)}
            >
              Không
            </button>
            <button
              type="button"
              onClick={() => setAnhHuong(true)}
              className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold ${
                anhHuong
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              Có (cần xếp lại)
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Mô tả <span className="text-red-600">*</span>
          </label>
          <textarea
            className={inputCls}
            rows={2}
            value={moTa}
            onChange={(e) => setMoTa(e.target.value)}
            placeholder="Vd: Máy cán kẹt trục, dừng sản xuất"
          />
        </div>

        <div>
          <label className={labelCls}>Hướng xử lý</label>
          <input
            className={inputCls}
            value={huongXuLy}
            onChange={(e) => setHuongXuLy(e.target.value)}
            placeholder="Vd: Chuyển sang máy khác / gọi kỹ thuật"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Đang lưu…" : "Lưu phát sinh"}
      </button>
    </form>
  );
}
