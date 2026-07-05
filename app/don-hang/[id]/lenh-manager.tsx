"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONG_DOAN, DO_UU_TIEN, type DoUuTien } from "@/lib/domain/enums";
import { NHAN_CONG_DOAN, NHAN_DO_UU_TIEN } from "@/lib/domain/labels";
import { BU_HAO_MAC_DINH_PHAN_TRAM } from "@/lib/domain/config";
import type { LenhDraftInput } from "@/lib/domain/inputs";
import { taoNhieuLenh } from "../actions";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function draftMoi(): LenhDraftInput {
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
  };
}

/** Parse ô số tùy chọn: rỗng → undefined; số hợp lệ → number; ngược lại → undefined. */
function parseOptionalNum(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function LenhManager({ maDon }: { maDon: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<LenhDraftInput[]>([draftMoi()]);

  const update = (idx: number, patch: Partial<LenhDraftInput>) =>
    setDrafts((cur) =>
      cur.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    );

  const toggleCongDoan = (idx: number, cd: string) =>
    setDrafts((cur) =>
      cur.map((d, i) => {
        if (i !== idx) return d;
        const has = d.CongDoanCanLam.includes(cd);
        return {
          ...d,
          CongDoanCanLam: has
            ? d.CongDoanCanLam.filter((c) => c !== cd)
            : [...d.CongDoanCanLam, cd],
        };
      }),
    );

  const themLenh = () => setDrafts((cur) => [...cur, draftMoi()]);
  const xoaLenh = (idx: number) =>
    setDrafts((cur) => (cur.length > 1 ? cur.filter((_, i) => i !== idx) : cur));

  function luu() {
    setError(null);
    for (const d of drafts) {
      if (d.CongDoanCanLam.length === 0) {
        setError("Mỗi lệnh cần chọn ít nhất 1 công đoạn.");
        return;
      }
    }
    startTransition(async () => {
      const res = await taoNhieuLenh(maDon, drafts);
      if (res.ok) {
        setDrafts([draftMoi()]);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Tạo lệnh sản xuất</h2>
        <button
          type="button"
          onClick={themLenh}
          className="rounded-md border border-brand px-3 py-1.5 text-sm text-brand hover:bg-blue-50"
        >
          ＋ Thêm lệnh
        </button>
      </div>

      <div className="space-y-4">
        {drafts.map((d, idx) => (
          <div key={idx} className="rounded-md border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Lệnh #{idx + 1}
              </span>
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => xoaLenh(idx)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Mô tả công việc
                </label>
                <input
                  className={inputCls}
                  value={d.MoTaCongViec}
                  onChange={(e) => update(idx, { MoTaCongViec: e.target.value })}
                  placeholder="Vd: In + gia công hộp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Độ ưu tiên
                </label>
                <select
                  className={inputCls}
                  value={d.DoUuTien}
                  onChange={(e) =>
                    update(idx, { DoUuTien: e.target.value as DoUuTien })
                  }
                >
                  {DO_UU_TIEN.map((p) => (
                    <option key={p} value={p}>
                      {NHAN_DO_UU_TIEN[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hạn hoàn thành
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={d.HanHoanThanh}
                  onChange={(e) => update(idx, { HanHoanThanh: e.target.value })}
                />
              </div>
            </div>

            {/* Thông số sản xuất (tùy chọn) — SoMau & LoaiGiay lấy từ đơn, không nhập lại. */}
            <div className="mt-3 rounded-md border border-dashed border-gray-200 p-3">
              <p className="mb-2 text-xs font-medium text-gray-500">
                Thông số sản xuất (tùy chọn)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Mã LSX xưởng
                  </label>
                  <input
                    className={inputCls}
                    value={d.MaLSXXuong ?? ""}
                    onChange={(e) => update(idx, { MaLSXXuong: e.target.value })}
                    placeholder="Vd: OS-25SL3101-30062026-3"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Bỏ trống nếu dùng mã hệ thống.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Khổ giấy
                  </label>
                  <input
                    className={inputCls}
                    value={d.KhoGiay ?? ""}
                    onChange={(e) => update(idx, { KhoGiay: e.target.value })}
                    placeholder="Vd: 700x965mm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Khổ in
                  </label>
                  <input
                    className={inputCls}
                    value={d.KhoIn ?? ""}
                    onChange={(e) => update(idx, { KhoIn: e.target.value })}
                    placeholder="Vd: 700x475mm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Số trang
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={inputCls}
                    value={d.SoTrang ?? ""}
                    onChange={(e) =>
                      update(idx, { SoTrang: parseOptionalNum(e.target.value) })
                    }
                    placeholder="Cho sản phẩm sách"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Bù hao (%)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    className={inputCls}
                    value={d.BuHaoPhanTram ?? ""}
                    onChange={(e) =>
                      update(idx, {
                        BuHaoPhanTram: parseOptionalNum(e.target.value),
                      })
                    }
                    placeholder={`Mặc định ${BU_HAO_MAC_DINH_PHAN_TRAM}%`}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Bỏ trống/0 → dùng mặc định {BU_HAO_MAC_DINH_PHAN_TRAM}% khi
                    tính thời lượng.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">
                Công đoạn cần làm (theo thứ tự chọn)
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONG_DOAN.map((cd) => {
                  const order = d.CongDoanCanLam.indexOf(cd);
                  const active = order >= 0;
                  return (
                    <button
                      type="button"
                      key={cd}
                      onClick={() => toggleCongDoan(idx, cd)}
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
          </div>
        ))}
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
          {pending
            ? "Đang lưu…"
            : `Lưu ${drafts.length} lệnh & chuyển "Chờ chế bản"`}
        </button>
      </div>
    </div>
  );
}
