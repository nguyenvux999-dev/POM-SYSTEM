"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CONG_DOAN,
  DO_UU_TIEN,
  type DoUuTien,
  type LenhTrangThai,
  type TrangThaiFile,
} from "@/lib/domain/enums";
import {
  NHAN_CONG_DOAN,
  NHAN_DO_UU_TIEN,
  NHAN_LENH_TRANG_THAI,
} from "@/lib/domain/labels";
import { BU_HAO_MAC_DINH_PHAN_TRAM } from "@/lib/domain/config";
import { parseCongDoan } from "@/lib/domain/schedule";
import { coTheXepLich, type QuyenLenh } from "@/lib/domain/gate";
import {
  Badge,
  BadgeFile,
  BadgeUuTien,
} from "@/components/status-badge";
import { MaLenhHienThi, ThongSoChips } from "@/components/lenh-specs";
import { suaLenh, xoaLenh } from "../actions";

/** VM một lệnh cho danh sách sửa/xóa (dựng ở server, kèm quyền đã tính). */
export interface LenhCardVM {
  MaLenh: string;
  MaLSXXuong: string;
  MoTaCongViec: string;
  CongDoanCanLam: string;
  DoUuTien: DoUuTien;
  HanHoanThanh: string;
  SoTrang: number;
  KhoGiay: string;
  KhoIn: string;
  BuHaoPhanTram: number;
  TrangThaiFile: TrangThaiFile;
  TrangThai: LenhTrangThai;
  quyen: QuyenLenh;
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelCls = "block text-sm font-medium text-gray-700";

function parseOptionalNum(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

interface EditDraft {
  MoTaCongViec: string;
  MaLSXXuong: string;
  DoUuTien: DoUuTien;
  SoTrang?: number;
  KhoGiay: string;
  KhoIn: string;
  CongDoanCanLam: string[];
  BuHaoPhanTram?: number;
  HanHoanThanh: string;
}

function toDraft(l: LenhCardVM): EditDraft {
  return {
    MoTaCongViec: l.MoTaCongViec,
    MaLSXXuong: l.MaLSXXuong,
    DoUuTien: l.DoUuTien,
    SoTrang: l.SoTrang > 0 ? l.SoTrang : undefined,
    KhoGiay: l.KhoGiay,
    KhoIn: l.KhoIn,
    CongDoanCanLam: parseCongDoan(l.CongDoanCanLam),
    BuHaoPhanTram: l.BuHaoPhanTram > 0 ? l.BuHaoPhanTram : undefined,
    HanHoanThanh: l.HanHoanThanh,
  };
}

export function LenhList({
  lenhs,
  don,
}: {
  lenhs: LenhCardVM[];
  don: { SoMau: string; LoaiGiay: string };
}) {
  if (lenhs.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Chưa có lệnh. Tạo lệnh bên dưới (mặc định 1 lệnh, có thể thêm nhiều).
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {lenhs.map((l) => (
        <LenhCard key={l.MaLenh} lenh={l} don={don} />
      ))}
    </div>
  );
}

function LenhCard({
  lenh,
  don,
}: {
  lenh: LenhCardVM;
  don: { SoMau: string; LoaiGiay: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "confirmXoa">("view");
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(lenh));

  const q = lenh.quyen;
  if (deleted) return null;

  const set = <K extends keyof EditDraft>(k: K, v: EditDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const toggleCongDoan = (cd: string) =>
    setDraft((d) => ({
      ...d,
      CongDoanCanLam: d.CongDoanCanLam.includes(cd)
        ? d.CongDoanCanLam.filter((c) => c !== cd)
        : [...d.CongDoanCanLam, cd],
    }));

  function moFormSua() {
    setDraft(toDraft(lenh));
    setError(null);
    setNote(null);
    setMode("edit");
  }

  function luu() {
    setError(null);
    if (draft.CongDoanCanLam.length === 0) {
      setError("Mỗi lệnh cần chọn ít nhất 1 công đoạn.");
      return;
    }
    startTransition(async () => {
      const res = await suaLenh(lenh.MaLenh, {
        MoTaCongViec: draft.MoTaCongViec,
        MaLSXXuong: draft.MaLSXXuong,
        DoUuTien: draft.DoUuTien,
        SoTrang: draft.SoTrang,
        KhoGiay: draft.KhoGiay,
        KhoIn: draft.KhoIn,
        CongDoanCanLam: draft.CongDoanCanLam,
        BuHaoPhanTram: draft.BuHaoPhanTram,
        HanHoanThanh: draft.HanHoanThanh,
      });
      if (res.ok) {
        setMode("view");
        setNote(
          res.canhBaoXepLai
            ? "Đã lưu. Lịch đã xếp không còn đúng — lệnh đã được đánh dấu CẦN XẾP LẠI (xem mục Phát sinh)."
            : "Đã lưu thay đổi.",
        );
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function xoa() {
    setError(null);
    setDeleted(true); // optimistic ẩn ngay
    startTransition(async () => {
      const res = await xoaLenh(lenh.MaLenh);
      if (res.ok) {
        router.refresh();
      } else {
        setDeleted(false);
        setMode("view");
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-md border border-gray-200 p-3">
      {/* Hàng mã + trạng thái */}
      <div className="flex flex-wrap items-center gap-2">
        <MaLenhHienThi maLenh={lenh.MaLenh} maLSXXuong={lenh.MaLSXXuong} />
        <BadgeFile value={lenh.TrangThaiFile} />
        <BadgeUuTien value={lenh.DoUuTien} />
        <Badge tone="gray">{NHAN_LENH_TRANG_THAI[lenh.TrangThai]}</Badge>
        {coTheXepLich(lenh) && <Badge tone="green">Sẵn sàng xếp lịch</Badge>}
        {q.chiDoc && (
          <span className="ml-auto text-xs text-gray-400">🔒 Đã hoàn thành — chỉ đọc</span>
        )}
      </div>

      {note && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {note}
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {mode !== "edit" && (
        <>
          {lenh.MoTaCongViec && (
            <p className="mt-1 text-sm text-gray-600">{lenh.MoTaCongViec}</p>
          )}
          <div className="mt-2">
            <ThongSoChips
              SoMau={don.SoMau}
              LoaiGiay={don.LoaiGiay}
              KhoGiay={lenh.KhoGiay}
              KhoIn={lenh.KhoIn}
              SoTrang={lenh.SoTrang}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {parseCongDoan(lenh.CongDoanCanLam).map((cd, i) => (
              <span
                key={`${cd}-${i}`}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {i + 1}. {NHAN_CONG_DOAN[cd] ?? cd}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {lenh.HanHoanThanh && <>Hạn hoàn thành: {lenh.HanHoanThanh} · </>}
            Bù hao:{" "}
            {lenh.BuHaoPhanTram > 0
              ? `${lenh.BuHaoPhanTram}%`
              : `${BU_HAO_MAC_DINH_PHAN_TRAM}% (mặc định)`}
          </p>

          {/* Nút hành động theo quyền */}
          {mode === "view" && !q.chiDoc && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={moFormSua}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                ✎ Sửa
              </button>
              {q.xoaDuoc && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("confirmXoa");
                  }}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  🗑 Xóa
                </button>
              )}
            </div>
          )}

          {/* Hộp xác nhận xóa */}
          {mode === "confirmXoa" && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                {q.xoaKemLich
                  ? "Xóa lệnh này sẽ xóa cả lịch đã xếp (LichChay) của nó. Tiếp tục?"
                  : `Xóa lệnh ${lenh.MaLenh}? Thao tác không hoàn tác.`}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={xoa}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {pending ? "Đang xóa…" : "Xóa"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setMode("view")}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form sửa */}
      {mode === "edit" && (
        <div className="mt-3 space-y-3">
          {/* Trường VÔ HẠI */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Mô tả công việc</label>
              <input
                className={inputCls}
                value={draft.MoTaCongViec}
                onChange={(e) => set("MoTaCongViec", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Mã LSX xưởng</label>
              <input
                className={inputCls}
                value={draft.MaLSXXuong}
                onChange={(e) => set("MaLSXXuong", e.target.value)}
                placeholder="Bỏ trống nếu dùng mã hệ thống"
              />
            </div>
            <div>
              <label className={labelCls}>Độ ưu tiên</label>
              <select
                className={inputCls}
                value={draft.DoUuTien}
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
              <label className={labelCls}>Số trang</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputCls}
                value={draft.SoTrang ?? ""}
                onChange={(e) =>
                  set("SoTrang", parseOptionalNum(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelCls}>Khổ giấy</label>
              <input
                className={inputCls}
                value={draft.KhoGiay}
                onChange={(e) => set("KhoGiay", e.target.value)}
                placeholder="Vd: 700x965mm"
              />
            </div>
            <div>
              <label className={labelCls}>Khổ in</label>
              <input
                className={inputCls}
                value={draft.KhoIn}
                onChange={(e) => set("KhoIn", e.target.value)}
                placeholder="Vd: 700x475mm"
              />
            </div>
          </div>

          {/* Trường ẢNH HƯỞNG LỊCH */}
          {q.suaAnhHuongLich ? (
            <div className="rounded-md border border-gray-200 p-3">
              {q.canhBaoXepLai && (
                <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  ⚠️ Lịch đã xếp — đổi công đoạn / bù hao / hạn sẽ khiến lịch cũ
                  không còn đúng, lệnh sẽ được đánh dấu <strong>cần xếp lại</strong>.
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Hạn hoàn thành</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={draft.HanHoanThanh}
                    onChange={(e) => set("HanHoanThanh", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bù hao (%)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    className={inputCls}
                    value={draft.BuHaoPhanTram ?? ""}
                    onChange={(e) =>
                      set("BuHaoPhanTram", parseOptionalNum(e.target.value))
                    }
                    placeholder={`Mặc định ${BU_HAO_MAC_DINH_PHAN_TRAM}%`}
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className={labelCls}>
                  Công đoạn cần làm (theo thứ tự chọn)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONG_DOAN.map((cd) => {
                    const order = draft.CongDoanCanLam.indexOf(cd);
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
            </div>
          ) : (
            // Bị khóa: hiện chỉ-đọc + lý do.
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
              <p className="mb-1 font-medium text-gray-600">
                🔒 Không sửa được công đoạn / bù hao / hạn
              </p>
              <p className="mb-2">{q.lyDoKhoaSua}</p>
              <p>
                Công đoạn:{" "}
                {parseCongDoan(lenh.CongDoanCanLam)
                  .map((cd, i) => `${i + 1}.${NHAN_CONG_DOAN[cd] ?? cd}`)
                  .join("  ")}
              </p>
              <p>
                Hạn: {lenh.HanHoanThanh || "—"} · Bù hao:{" "}
                {lenh.BuHaoPhanTram > 0
                  ? `${lenh.BuHaoPhanTram}%`
                  : `${BU_HAO_MAC_DINH_PHAN_TRAM}% (mặc định)`}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={luu}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
