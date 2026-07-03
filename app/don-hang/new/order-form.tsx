"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONG_DOAN } from "@/lib/domain/enums";
import { NHAN_CONG_DOAN } from "@/lib/domain/labels";
import { kiemTraKhaThi } from "@/lib/domain/feasibility";
import type { BangNangLuc } from "@/lib/domain/estimate";
import type { DonHangInput } from "@/lib/domain/inputs";
import { taoDon } from "../actions";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelCls = "block text-sm font-medium text-gray-700";

export function OrderForm({
  bangNangLuc,
  homNay,
}: {
  bangNangLuc: BangNangLuc;
  homNay: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    NgayNhan: homNay,
    KhachHang: "",
    NVKinhDoanh: "",
    TenSanPham: "",
    SoLuong: "",
    KhoThanhPham: "",
    LoaiGiay: "",
    SoMau: "",
    GiaCongSauIn: "",
    NgayGiaoHang: "",
    GhiChu: "",
  });
  const [congDoan, setCongDoan] = useState<string[]>(["In"]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleCongDoan = (cd: string) =>
    setCongDoan((cur) =>
      cur.includes(cd) ? cur.filter((c) => c !== cd) : [...cur, cd],
    );

  const soLuongNum = Number(form.SoLuong);

  // Kiểm tra khả thi hạn giao ngay khi có đủ dữ liệu.
  const khaThi = useMemo(() => {
    if (!form.NgayGiaoHang || !(soLuongNum > 0) || congDoan.length === 0) {
      return null;
    }
    return kiemTraKhaThi(
      soLuongNum,
      congDoan,
      form.NgayGiaoHang,
      bangNangLuc,
      homNay,
    );
  }, [form.NgayGiaoHang, soLuongNum, congDoan, bangNangLuc, homNay]);

  function submit() {
    setError(null);
    if (!form.TenSanPham.trim()) return setError("Vui lòng nhập Tên sản phẩm.");
    if (!form.KhachHang.trim()) return setError("Vui lòng nhập Khách hàng.");
    if (!(soLuongNum > 0)) return setError("Số lượng phải là số dương.");
    if (!form.NgayGiaoHang) return setError("Vui lòng chọn Ngày giao hàng.");

    const payload: DonHangInput = {
      NgayNhan: form.NgayNhan,
      KhachHang: form.KhachHang.trim(),
      NVKinhDoanh: form.NVKinhDoanh.trim(),
      TenSanPham: form.TenSanPham.trim(),
      SoLuong: soLuongNum,
      KhoThanhPham: form.KhoThanhPham.trim(),
      LoaiGiay: form.LoaiGiay.trim(),
      SoMau: form.SoMau.trim(),
      GiaCongSauIn: form.GiaCongSauIn.trim(),
      NgayGiaoHang: form.NgayGiaoHang,
      GhiChu: form.GhiChu.trim(),
    };

    startTransition(async () => {
      const res = await taoDon(payload);
      if (res.ok) {
        router.push(`/don-hang/${res.maDon}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs text-gray-500">
          Trạng thái đơn mới: <strong>Mới</strong>. Trường có{" "}
          <span className="text-red-600">*</span> là bắt buộc.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Tên sản phẩm <span className="text-red-600">*</span>
            </label>
            <input
              className={inputCls}
              value={form.TenSanPham}
              onChange={(e) => set("TenSanPham")(e.target.value)}
              placeholder="Vd: Hộp giấy, Catalogue"
            />
          </div>
          <div>
            <label className={labelCls}>
              Khách hàng <span className="text-red-600">*</span>
            </label>
            <input
              className={inputCls}
              value={form.KhachHang}
              onChange={(e) => set("KhachHang")(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>NV kinh doanh</label>
            <input
              className={inputCls}
              value={form.NVKinhDoanh}
              onChange={(e) => set("NVKinhDoanh")(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>
              Số lượng <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={inputCls}
              value={form.SoLuong}
              onChange={(e) => set("SoLuong")(e.target.value)}
              placeholder="Vd: 20000"
            />
          </div>
          <div>
            <label className={labelCls}>Ngày nhận</label>
            <input
              type="date"
              className={inputCls}
              value={form.NgayNhan}
              onChange={(e) => set("NgayNhan")(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>
              Ngày giao hàng <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              className={inputCls}
              value={form.NgayGiaoHang}
              onChange={(e) => set("NgayGiaoHang")(e.target.value)}
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
            <label className={labelCls}>Số màu</label>
            <input
              className={inputCls}
              value={form.SoMau}
              onChange={(e) => set("SoMau")(e.target.value)}
              placeholder="Vd: 4/4, 4/0"
            />
          </div>
          <div>
            <label className={labelCls}>Gia công sau in</label>
            <input
              className={inputCls}
              value={form.GiaCongSauIn}
              onChange={(e) => set("GiaCongSauIn")(e.target.value)}
              placeholder="Vd: Cán mờ; Bế; Dán hộp"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelCls}>Ghi chú</label>
          <textarea
            className={inputCls}
            rows={2}
            value={form.GhiChu}
            onChange={(e) => set("GhiChu")(e.target.value)}
          />
        </div>
      </div>

      {/* Công đoạn dự kiến — chỉ để ước tính khả thi, không lưu vào đơn */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className={labelCls}>Công đoạn dự kiến (để ước tính khả thi hạn giao)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONG_DOAN.map((cd) => {
            const active = congDoan.includes(cd);
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
                {NHAN_CONG_DOAN[cd]}
              </button>
            );
          })}
        </div>

        {khaThi && (
          <div
            className={`mt-3 rounded-md border p-3 text-sm ${
              khaThi.khaThi
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {khaThi.khaThi ? (
              <span>
                ✅ Khả thi — cần ~{khaThi.tongNgayCanThiet} ngày, còn{" "}
                {khaThi.soNgayConLai} ngày tới hạn giao.
              </span>
            ) : (
              <span>⚠️ {khaThi.canhBao}</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Đang lưu…" : "Lưu đơn hàng"}
        </button>
      </div>
    </form>
  );
}
