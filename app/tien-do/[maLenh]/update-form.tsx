"use client";

import { useOptimistic, useState, useTransition } from "react";
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

/** Thay đổi lạc quan áp lên một công đoạn khi bấm Lưu. */
type OptimisticPatch = {
  congDoan: CongDoan;
  trangThai: "DangChay" | "Xong";
  soLuong: number;
};

/**
 * Bảng tiến độ (mobile-first): thẻ tóm tắt "đạt X/Y" + form cập nhật 3 CHẠM.
 *
 * Cập nhật LẠC QUAN (useOptimistic): khi bấm Lưu, con số "đạt" và badge trạng
 * thái đổi NGAY trên màn, rồi ghi nền. Ghi xong → router.refresh() nạp số thật
 * (số lạc quan hòa vào số thật, không nhấp nháy). Ghi lỗi → transition kết thúc
 * mà không refresh → số tự quay về giá trị cũ (rollback) và hiện thông báo lỗi.
 */
export function ProgressPanel({
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

  const [optimisticStages, applyOptimistic] = useOptimistic(
    stages,
    (cur: StageVM[], patch: OptimisticPatch): StageVM[] =>
      cur.map((s) =>
        s.CongDoan === patch.congDoan
          ? {
              ...s,
              SoLuongDat: patch.soLuong,
              TrangThai: patch.trangThai === "Xong" ? "Xong" : "DangChay",
            }
          : s,
      ),
  );

  const stage = optimisticStages.find((s) => s.CongDoan === cd) ?? null;

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
    const congDoan = cd;
    const trangThai = tt;
    startTransition(async () => {
      // 1) Đổi ngay con số trên màn (lạc quan).
      applyOptimistic({ congDoan, trangThai, soLuong: n });
      // 2) Ghi nền.
      const res = await capNhatTienDo(maLenh, congDoan, trangThai, n);
      if (res.ok) {
        setOk(
          `✅ Đã lưu: ${NHAN_CONG_DOAN[congDoan]} → ${
            trangThai === "Xong" ? "Xong" : "Đang chạy"
          } (${n.toLocaleString()})`,
        );
        setCd(null);
        setTt(null);
        setSl("");
        // Nạp số thật; giữ transition mở tới khi dữ liệu mới về (không nhấp nháy).
        router.refresh();
      } else {
        // Không refresh → useOptimistic tự rollback về số cũ.
        setErr(res.error);
      }
    });
  }

  const btnBig =
    "rounded-xl border-2 px-4 py-4 text-base font-semibold transition active:scale-[0.98]";

  return (
    <div className="space-y-4">
      {/* Tóm tắt các công đoạn hiện tại (đổi ngay khi Lưu nhờ optimistic) */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="mb-2 text-sm font-semibold text-gray-700">Công đoạn</p>
        <div className="space-y-1">
          {optimisticStages.map((s) => (
            <div
              key={s.MaLich}
              className="flex items-center justify-between border-b border-gray-100 py-1 text-sm last:border-0"
            >
              <span className="text-gray-700">
                {NHAN_CONG_DOAN[s.CongDoan]}{" "}
                <span className="text-xs text-gray-400">
                  {s.BatDauDuKien.slice(5, 16)}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                đạt {s.SoLuongDat.toLocaleString()}/{soLuong.toLocaleString()}
              </span>
            </div>
          ))}
          {optimisticStages.length === 0 && (
            <p className="text-sm text-gray-400">
              Lệnh chưa có công đoạn nào được xếp lịch.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
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
            {optimisticStages.map((s) => (
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
            {optimisticStages.length === 0 && (
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
              2. Trạng thái mới cho{" "}
              <strong>{NHAN_CONG_DOAN[stage.CongDoan]}</strong>
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
    </div>
  );
}
