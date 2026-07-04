"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CongDoan, LichTrangThai } from "@/lib/domain/enums";
import { NHAN_CONG_DOAN } from "@/lib/domain/labels";
import { BadgeLich } from "@/components/status-badge";
import { capNhatTienDo } from "../actions";

export interface StageVM {
  MaLich: string;
  CongDoan: CongDoan;
  MaMay: string;
  TrangThai: LichTrangThai;
  BatDauDuKien: string;
  KetThucDuKien: string;
  SoLuongDat: number;
}

/**
 * Cập nhật tiến độ 3 CHẠM (mobile-first):
 *  1) chọn công đoạn → 2) chọn trạng thái mới → 3) nhập số lượng đạt → Lưu.
 * Nút to, ít gõ; dùng tốt trên màn ~380px.
 */
export function UpdateForm({
  maLenh,
  soLuong,
  stages,
}: {
  maLenh: string;
  soLuong: number;
  stages: StageVM[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cd, setCd] = useState<CongDoan | null>(null);
  const [tt, setTt] = useState<"DangChay" | "Xong" | null>(null);
  const [sl, setSl] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const stage = stages.find((s) => s.CongDoan === cd) ?? null;

  function chonCongDoan(s: StageVM) {
    setCd(s.CongDoan);
    setTt(null);
    setSl(s.SoLuongDat ? String(s.SoLuongDat) : "");
    setErr(null);
    setOk(null);
  }

  function chonTrangThai(v: "DangChay" | "Xong") {
    setTt(v);
    // "Xong" mặc định đủ số lượng; "DangChay" giữ số hiện có.
    if (v === "Xong") setSl(String(soLuong));
    else if (stage) setSl(stage.SoLuongDat ? String(stage.SoLuongDat) : "");
    setErr(null);
  }

  function luu() {
    if (!cd || !tt) return;
    const n = Number(sl);
    if (!Number.isFinite(n) || n < 0) {
      setErr("Số lượng đạt phải là số ≥ 0.");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await capNhatTienDo(maLenh, cd, tt, n);
      if (res.ok) {
        setOk(
          `✅ Đã lưu: ${NHAN_CONG_DOAN[cd]} → ${tt === "Xong" ? "Xong" : "Đang chạy"} (${n.toLocaleString()})`,
        );
        setCd(null);
        setTt(null);
        setSl("");
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  const btnBig =
    "rounded-xl border-2 px-4 py-4 text-base font-semibold transition active:scale-[0.98]";

  return (
    <div className="space-y-4">
      {ok && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {ok}
        </div>
      )}
      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Bước 1 — chọn công đoạn */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          1. Chọn công đoạn
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stages.map((s) => (
            <button
              key={s.MaLich}
              type="button"
              onClick={() => chonCongDoan(s)}
              className={`${btnBig} text-left ${
                cd === s.CongDoan
                  ? "border-brand bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className="block">{NHAN_CONG_DOAN[s.CongDoan]}</span>
              <span className="mt-1 block">
                <BadgeLich value={s.TrangThai} />
              </span>
            </button>
          ))}
          {stages.length === 0 && (
            <p className="col-span-full text-sm text-gray-400">
              Lệnh chưa có công đoạn nào được xếp lịch.
            </p>
          )}
        </div>
      </div>

      {/* Bước 2 — chọn trạng thái */}
      {stage && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            2. Trạng thái mới cho <strong>{NHAN_CONG_DOAN[stage.CongDoan]}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => chonTrangThai("DangChay")}
              className={`${btnBig} ${
                tt === "DangChay"
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              ▶ Bắt đầu chạy
            </button>
            <button
              type="button"
              onClick={() => chonTrangThai("Xong")}
              className={`${btnBig} ${
                tt === "Xong"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              ✓ Xong công đoạn
            </button>
          </div>
        </div>
      )}

      {/* Bước 3 — số lượng đạt + lưu */}
      {stage && tt && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            3. Số lượng đạt
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              className="w-40 rounded-lg border border-gray-300 px-4 py-3 text-lg"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => setSl(String(soLuong))}
              className="rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-700 hover:bg-gray-100"
            >
              Đủ {soLuong.toLocaleString()}
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={luu}
            className="mt-3 w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Đang lưu…" : "Lưu tiến độ"}
          </button>
        </div>
      )}
    </div>
  );
}
