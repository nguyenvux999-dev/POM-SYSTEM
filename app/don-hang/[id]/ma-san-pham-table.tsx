"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CANH_BAO_THEM_XOA_MA_SP,
  quyenSuaMaSP,
  type MucLenh,
} from "@/lib/domain/gate";
import type { MaSanPhamInput } from "@/lib/domain/inputs";
import { suaMaSP, themMaSP, xoaMaSP } from "../actions";

/** Một dòng mã sản phẩm để hiển thị/sửa (thuần mô tả). */
export interface MaSanPhamRow {
  MaDongSP: string;
  MaSanPham: string;
  TenSanPham: string;
  KichThuoc: string;
  SoLuong: number;
}

/** Bản nháp nhập liệu (SoLuong giữ CHUỖI để gõ tự do trong input, parse khi lưu). */
interface DraftMa {
  MaSanPham: string;
  TenSanPham: string;
  KichThuoc: string;
  SoLuong: string;
}

const cellInputCls =
  "w-full min-w-20 rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const btnNhoCls =
  "rounded px-1.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40";

function draftRong(): DraftMa {
  return { MaSanPham: "", TenSanPham: "", KichThuoc: "", SoLuong: "" };
}

function draftTuRow(r: MaSanPhamRow): DraftMa {
  return {
    MaSanPham: r.MaSanPham,
    TenSanPham: r.TenSanPham,
    KichThuoc: r.KichThuoc,
    SoLuong: r.SoLuong > 0 ? String(r.SoLuong) : "",
  };
}

/** Validate phía CLIENT (Server Action kiểm lại y hệt, không tin UI). */
function parseDraft(
  d: DraftMa,
): { ok: true; input: MaSanPhamInput } | { ok: false; error: string } {
  if (!d.MaSanPham.trim() && !d.TenSanPham.trim()) {
    return { ok: false, error: "Cần nhập Mã SP hoặc Tên sản phẩm." };
  }
  const so = Number(d.SoLuong);
  if (!(so > 0)) return { ok: false, error: "Số lượng phải là số > 0." };
  return {
    ok: true,
    input: {
      MaSanPham: d.MaSanPham.trim(),
      TenSanPham: d.TenSanPham.trim(),
      KichThuoc: d.KichThuoc.trim(),
      SoLuong: so,
    },
  };
}

/**
 * Bảng "Mã sản phẩm trong lệnh" — sửa inline / thêm / xóa SAU KHI lệnh đã tạo.
 * Mã SP thuần mô tả, KHÔNG nuôi công thức thời lượng → thao tác ở đây không
 * đụng lịch/trạng thái. Optimistic UI: đổi ngay, ghi nền, lỗi thì rollback.
 */
export function MaSanPhamTable({
  maLenh,
  initial,
  muc,
}: {
  maLenh: string;
  initial: MaSanPhamRow[];
  muc: MucLenh;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const q = quyenSuaMaSP(muc);

  // State dẫn xuất từ props: re-seed khi dữ liệu server đổi (sau router.refresh()).
  const sig = JSON.stringify(initial);
  const [seedSig, setSeedSig] = useState(sig);
  const [rows, setRows] = useState<MaSanPhamRow[]>(initial);
  if (sig !== seedSig) {
    setSeedSig(sig);
    setRows(initial);
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmXoaId, setConfirmXoaId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftMa>(draftRong());
  const [error, setError] = useState<string | null>(null);
  const tmpSeq = useRef(0);

  const conMotDong = rows.length <= 1;
  const setD = (k: keyof DraftMa, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function moThem() {
    setError(null);
    setConfirmXoaId(null);
    setEditId(null);
    setDraft(draftRong());
    setAdding(true);
  }

  function moSua(r: MaSanPhamRow) {
    setError(null);
    setConfirmXoaId(null);
    setAdding(false);
    setDraft(draftTuRow(r));
    setEditId(r.MaDongSP);
  }

  function huyForm() {
    setEditId(null);
    setAdding(false);
    setError(null);
  }

  function luuSua(id: string) {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const prev = rows;
    // Optimistic: đổi ngay, ghi nền, lỗi thì rollback.
    setRows((cur) =>
      cur.map((r) => (r.MaDongSP === id ? { ...r, ...parsed.input } : r)),
    );
    setEditId(null);
    startTransition(async () => {
      const res = await suaMaSP(id, parsed.input);
      if (res.ok) {
        router.refresh();
      } else {
        setRows(prev);
        setError(res.error);
      }
    });
  }

  function luuThem() {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const tmpId = `tmp-${++tmpSeq.current}`;
    setRows((cur) => [...cur, { MaDongSP: tmpId, ...parsed.input }]);
    setAdding(false);
    startTransition(async () => {
      const res = await themMaSP(maLenh, parsed.input);
      if (res.ok) {
        // Gắn MaDongSP thật cho dòng tạm trong lúc chờ dữ liệu server về.
        setRows((cur) =>
          cur.map((r) =>
            r.MaDongSP === tmpId ? { ...r, MaDongSP: res.maDongSP } : r,
          ),
        );
        router.refresh();
      } else {
        setRows((cur) => cur.filter((r) => r.MaDongSP !== tmpId));
        setError(res.error);
      }
    });
  }

  function xoa(id: string) {
    setError(null);
    const prev = rows;
    setRows((cur) => cur.filter((r) => r.MaDongSP !== id));
    setConfirmXoaId(null);
    startTransition(async () => {
      const res = await xoaMaSP(id);
      if (res.ok) {
        router.refresh();
      } else {
        setRows(prev);
        setError(res.error);
      }
    });
  }

  const rowXoa = confirmXoaId
    ? rows.find((r) => r.MaDongSP === confirmXoaId)
    : undefined;

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">
          Mã sản phẩm trong lệnh
        </span>
        {q.themXoaDuoc && (
          <button
            type="button"
            onClick={moThem}
            disabled={pending}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            ＋ Thêm mã
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {rows.length === 0 && !adding ? (
        <p className="rounded-md border border-dashed border-gray-200 p-2 text-xs text-gray-400">
          Chưa có mã sản phẩm trong lệnh.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2 py-1">Mã SP</th>
                <th className="px-2 py-1">Tên</th>
                <th className="px-2 py-1">Kích thước</th>
                <th className="px-2 py-1 text-right">SL</th>
                {q.suaDuoc && <th className="px-2 py-1 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((m) =>
                editId === m.MaDongSP ? (
                  <tr key={m.MaDongSP} className="bg-gray-50">
                    <td className="px-2 py-1">
                      <input
                        className={cellInputCls}
                        value={draft.MaSanPham}
                        onChange={(e) => setD("MaSanPham", e.target.value)}
                        placeholder="Mã SP"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={cellInputCls}
                        value={draft.TenSanPham}
                        onChange={(e) => setD("TenSanPham", e.target.value)}
                        placeholder="Tên sản phẩm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={cellInputCls}
                        value={draft.KichThuoc}
                        onChange={(e) => setD("KichThuoc", e.target.value)}
                        placeholder="Kích thước"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className={`${cellInputCls} text-right`}
                        value={draft.SoLuong}
                        onChange={(e) => setD("SoLuong", e.target.value)}
                        placeholder="SL"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => luuSua(m.MaDongSP)}
                        disabled={pending}
                        className={`${btnNhoCls} text-brand hover:bg-gray-100`}
                      >
                        ✓ Lưu
                      </button>
                      <button
                        type="button"
                        onClick={huyForm}
                        disabled={pending}
                        className={`${btnNhoCls} text-gray-500 hover:bg-gray-100`}
                      >
                        ✕ Hủy
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.MaDongSP}>
                    <td className="px-2 py-1 font-mono">{m.MaSanPham || "—"}</td>
                    <td className="px-2 py-1">{m.TenSanPham || "—"}</td>
                    <td className="px-2 py-1">{m.KichThuoc || "—"}</td>
                    <td className="px-2 py-1 text-right">
                      {m.SoLuong ? m.SoLuong.toLocaleString() : "—"}
                    </td>
                    {q.suaDuoc && (
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => moSua(m)}
                          disabled={pending}
                          className={`${btnNhoCls} text-gray-600 hover:bg-gray-100`}
                        >
                          ✎ Sửa
                        </button>
                        {q.themXoaDuoc && (
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setEditId(null);
                              setAdding(false);
                              setConfirmXoaId(m.MaDongSP);
                            }}
                            disabled={pending || conMotDong}
                            title={
                              conMotDong
                                ? "Lệnh phải có ít nhất 1 mã sản phẩm"
                                : undefined
                            }
                            className={`${btnNhoCls} text-red-600 hover:bg-red-50`}
                          >
                            🗑 Xóa
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Xác nhận xóa (kèm cảnh báo MỀM khi lệnh đang chạy — vẫn cho phép) */}
      {rowXoa && (
        <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2">
          <p className="text-xs text-red-700">
            Xóa mã{" "}
            <strong>
              {rowXoa.MaSanPham || rowXoa.TenSanPham || rowXoa.MaDongSP}
            </strong>{" "}
            khỏi lệnh?
          </p>
          {q.canhBaoThemXoa && (
            <p className="mt-1 text-xs text-amber-800">
              ⚠️ {CANH_BAO_THEM_XOA_MA_SP}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => xoa(rowXoa.MaDongSP)}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Xóa
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmXoaId(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Form thêm mã (kèm cảnh báo MỀM khi lệnh đang chạy — vẫn cho phép) */}
      {adding && (
        <div className="mt-2 rounded-md border border-gray-200 p-2">
          {q.canhBaoThemXoa && (
            <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              ⚠️ {CANH_BAO_THEM_XOA_MA_SP}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              className={cellInputCls}
              value={draft.MaSanPham}
              onChange={(e) => setD("MaSanPham", e.target.value)}
              placeholder="Mã SP"
            />
            <input
              className={cellInputCls}
              value={draft.TenSanPham}
              onChange={(e) => setD("TenSanPham", e.target.value)}
              placeholder="Tên sản phẩm"
            />
            <input
              className={cellInputCls}
              value={draft.KichThuoc}
              onChange={(e) => setD("KichThuoc", e.target.value)}
              placeholder="Kích thước"
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={cellInputCls}
              value={draft.SoLuong}
              onChange={(e) => setD("SoLuong", e.target.value)}
              placeholder="Số lượng"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={luuThem}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu mã"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={huyForm}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
