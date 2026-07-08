"use client";

/**
 * UI Thư viện sản phẩm: ô tìm kiếm + lưới thẻ (ảnh, mã, tên, khách hàng) +
 * modal thêm/sửa/xóa. Mobile-first — planner tra cứu bằng điện thoại ngoài xưởng.
 *
 * Tìm kiếm lọc trong RAM từ danh sách đã đọc sẵn (không gọi API mỗi lần gõ).
 * Sau mỗi thao tác ghi: cập nhật danh sách cục bộ ngay (optimistic) rồi
 * router.refresh() để đồng bộ lại từ server.
 */

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ThuVienSanPham } from "@/lib/domain/types";
import { suaSanPham, themSanPham, xoaSanPham } from "./actions";

/** Đồng bộ với validate server-side trong actions.ts. */
const ANH_ACCEPT = "image/jpeg,image/png,image/webp";
const ANH_HOP_LE = ["image/jpeg", "image/png", "image/webp"];
const ANH_TOI_DA_BYTES = 4 * 1024 * 1024;

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelCls = "block text-sm font-medium text-gray-700";

/** Kiểm tra ảnh phía client (chặn sớm trước khi gửi lên server). */
function kiemTraAnhClient(file: File): string | null {
  if (!ANH_HOP_LE.includes(file.type)) return "Ảnh phải là JPG, PNG hoặc WEBP.";
  if (file.size > ANH_TOI_DA_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Ảnh ${mb} MB — vượt giới hạn 4 MB. Hãy giảm kích thước rồi thử lại.`;
  }
  return null;
}

/** Ảnh sản phẩm trong thẻ; AnhUrl trống → placeholder, không lỗi. */
function AnhSanPham({ sp }: { sp: ThuVienSanPham }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
      {sp.AnhUrl ? (
        <Image
          src={sp.AnhUrl}
          alt={sp.TenSanPham || sp.MaSanPham}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-300">
          <span className="text-4xl">🖼️</span>
          <span className="text-xs">Chưa có ảnh</span>
        </div>
      )}
    </div>
  );
}

type ModalState = { mode: "them" } | { mode: "sua"; sp: ThuVienSanPham } | null;

export function ThuVienClient({ dsBanDau }: { dsBanDau: ThuVienSanPham[] }) {
  const router = useRouter();
  const [ds, setDs] = useState(dsBanDau);
  const [tuKhoa, setTuKhoa] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  // Server refresh xong (props mới) → lấy dữ liệu server làm chân lý.
  useEffect(() => setDs(dsBanDau), [dsBanDau]);

  const dsLoc = useMemo(() => {
    const q = tuKhoa.trim().toLowerCase();
    if (!q) return ds;
    return ds.filter(
      (sp) =>
        sp.MaSanPham.toLowerCase().includes(q) ||
        sp.TenSanPham.toLowerCase().includes(q),
    );
  }, [ds, tuKhoa]);

  /** Optimistic: áp thay đổi vào danh sách cục bộ ngay, rồi đồng bộ từ server. */
  function apDungThayDoi(next: (cur: ThuVienSanPham[]) => ThuVienSanPham[]) {
    setDs(next);
    setModal(null);
    router.refresh();
  }

  return (
    // Tiêu đề + tìm kiếm cố định; lưới thẻ là vùng cuộn (min-h-0 bắt buộc).
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Thư viện sản phẩm</h1>
        <button
          onClick={() => setModal({ mode: "them" })}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          ＋ Thêm sản phẩm
        </button>
      </div>

      <input
        type="search"
        value={tuKhoa}
        onChange={(e) => setTuKhoa(e.target.value)}
        placeholder="Tìm theo mã hoặc tên sản phẩm…"
        className={`${inputCls} shrink-0`}
      />

      <p className="shrink-0 text-xs text-gray-500">
        {dsLoc.length}/{ds.length} sản phẩm
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {dsLoc.map((sp) => (
            <button
              key={sp.MaSanPham}
              onClick={() => setModal({ mode: "sua", sp })}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-brand hover:shadow"
            >
              <AnhSanPham sp={sp} />
              <div className="space-y-0.5 p-2.5">
                <p className="font-mono text-sm font-bold text-gray-900">
                  {sp.MaSanPham}
                </p>
                <p className="line-clamp-2 text-sm text-gray-700">
                  {sp.TenSanPham}
                </p>
                {sp.KhachHang && (
                  <p className="truncate text-xs text-gray-500">
                    {sp.KhachHang}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {dsLoc.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            {ds.length === 0
              ? "Thư viện chưa có sản phẩm nào — bấm “＋ Thêm sản phẩm” để bắt đầu."
              : "Không có sản phẩm nào khớp từ khóa."}
          </div>
        )}
      </div>

      {modal && (
        <SanPhamModal
          sp={modal.mode === "sua" ? modal.sp : null}
          onClose={() => setModal(null)}
          onSaved={(spMoi, maCu) =>
            apDungThayDoi((cur) =>
              maCu
                ? cur.map((x) => (x.MaSanPham === maCu ? spMoi : x))
                : [...cur, spMoi],
            )
          }
          onDeleted={(ma) =>
            apDungThayDoi((cur) => cur.filter((x) => x.MaSanPham !== ma))
          }
        />
      )}
    </div>
  );
}

/** Modal form thêm (sp=null) / sửa (sp có giá trị) một sản phẩm. */
function SanPhamModal({
  sp,
  onClose,
  onSaved,
  onDeleted,
}: {
  sp: ThuVienSanPham | null;
  onClose: () => void;
  onSaved: (spMoi: ThuVienSanPham, maCu?: string) => void;
  onDeleted: (ma: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    MaSanPham: sp?.MaSanPham ?? "",
    TenSanPham: sp?.TenSanPham ?? "",
    KhachHang: sp?.KhachHang ?? "",
    KhoThanhPham: sp?.KhoThanhPham ?? "",
    LoaiGiay: sp?.LoaiGiay ?? "",
    GhiChu: sp?.GhiChu ?? "",
  });
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    setError(null);
    if (!form.MaSanPham.trim()) return setError("Vui lòng nhập Mã sản phẩm.");
    if (!form.TenSanPham.trim()) return setError("Vui lòng nhập Tên sản phẩm.");

    const file = fileRef.current?.files?.[0];
    if (file) {
      const loiAnh = kiemTraAnhClient(file);
      if (loiAnh) return setError(loiAnh);
    }

    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.set(k, v.trim());
    if (file) fd.set("anh", file);

    startTransition(async () => {
      const res = sp
        ? await suaSanPham(sp.MaSanPham, fd)
        : await themSanPham(fd);
      if (res.ok) onSaved(res.sanPham, sp?.MaSanPham);
      else setError(res.error);
    });
  }

  function xoa() {
    if (!sp) return;
    const chac = window.confirm(
      `Xóa sản phẩm "${sp.MaSanPham}" khỏi thư viện?\nBản ghi và ảnh trên kho sẽ bị xóa vĩnh viễn.`,
    );
    if (!chac) return;
    setError(null);
    startTransition(async () => {
      const res = await xoaSanPham(sp.MaSanPham);
      if (res.ok) onDeleted(sp.MaSanPham);
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 sm:max-w-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {sp ? `Sửa sản phẩm ${sp.MaSanPham}` : "Thêm sản phẩm"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>
                Mã sản phẩm <span className="text-red-600">*</span>
              </label>
              <input
                className={inputCls}
                value={form.MaSanPham}
                onChange={(e) => set("MaSanPham")(e.target.value)}
                placeholder="Vd: SP-HOP-001"
              />
            </div>
            <div>
              <label className={labelCls}>
                Tên sản phẩm <span className="text-red-600">*</span>
              </label>
              <input
                className={inputCls}
                value={form.TenSanPham}
                onChange={(e) => set("TenSanPham")(e.target.value)}
                placeholder="Vd: Hộp giấy 2 lớp"
              />
            </div>
            <div>
              <label className={labelCls}>Khách hàng</label>
              <input
                className={inputCls}
                value={form.KhachHang}
                onChange={(e) => set("KhachHang")(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Khổ thành phẩm</label>
              <input
                className={inputCls}
                value={form.KhoThanhPham}
                onChange={(e) => set("KhoThanhPham")(e.target.value)}
                placeholder="Vd: 21x29.7"
              />
            </div>
            <div>
              <label className={labelCls}>Loại giấy</label>
              <input
                className={inputCls}
                value={form.LoaiGiay}
                onChange={(e) => set("LoaiGiay")(e.target.value)}
                placeholder="Vd: Couche 250gsm"
              />
            </div>
            <div>
              <label className={labelCls}>
                Ảnh {sp?.AnhUrl ? "(chọn để thay ảnh cũ)" : ""}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={ANH_ACCEPT}
                className="w-full text-sm text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="mt-1 text-xs text-gray-400">
                JPG/PNG/WEBP, tối đa 4 MB.
              </p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea
              className={inputCls}
              rows={2}
              value={form.GhiChu}
              onChange={(e) => set("GhiChu")(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {sp ? (
              <button
                type="button"
                onClick={xoa}
                disabled={pending}
                className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Xóa sản phẩm
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {pending ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
