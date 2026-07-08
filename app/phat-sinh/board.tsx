"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  CongDoan,
  MayTrangThai,
  MucDo,
  PhatSinhLoai,
  PhatSinhTrangThai,
} from "@/lib/domain/enums";
import type { LichChay, May } from "@/lib/domain/types";
import { CONGDOAN_MAY } from "@/lib/domain/config";
import { parseCongDoan } from "@/lib/domain/schedule";
import { tinhLaiLichConLai, type NguyCoTreItem } from "@/lib/domain/reschedule";
import { treHan } from "@/lib/domain/assist";
import { parseLocal } from "@/lib/domain/datetime";
import {
  NHAN_CONG_DOAN,
  NHAN_MAY_TRANG_THAI,
  NHAN_PHAT_SINH_LOAI,
} from "@/lib/domain/labels";
import { BadgeMay, BadgeMucDo, BadgePhatSinh } from "@/components/status-badge";
import { MaLenhHienThi, MaSPHienThi } from "@/components/lenh-specs";
import {
  capNhatTrangThaiMay,
  doiTrangThaiPhatSinh,
  xepLaiSuCo,
} from "./actions";

export interface PhatSinhVM {
  MaPhatSinh: string;
  MaLenh: string;
  MaLSXXuong: string;
  Loai: PhatSinhLoai;
  MoTa: string;
  MucDo: MucDo;
  AnhHuongTienDo: boolean;
  HuongXuLy: string;
  TrangThai: PhatSinhTrangThai;
  ThoiGian: string;
  TenSanPham: string;
  KhachHang: string;
}

export interface CanXepLaiVM {
  MaLenh: string;
  MaLSXXuong: string;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  CongDoanCanLam: string;
  SoToIn: number;
  BuHaoPhanTram: number;
  boiPhatSinh: boolean;
  boiMayLoi: boolean;
  congDoanBiKet: {
    CongDoan: CongDoan;
    tenMay: string;
    mayTrangThai: MayTrangThai;
  }[];
}

function gio(s: string): string {
  return s.length >= 16 ? s.slice(11, 16) : s;
}
function ngay(s: string): string {
  return s.slice(0, 10);
}

export function PhatSinhBoard({
  phatSinh,
  canXepLai,
  nguyCoTre,
  may,
  lichAll,
  maSPTheoLenh,
  now,
}: {
  phatSinh: PhatSinhVM[];
  canXepLai: CanXepLaiVM[];
  nguyCoTre: NguyCoTreItem[];
  may: May[];
  lichAll: LichChay[];
  /** Nhãn mã SP theo MaLenh (join sẵn ở server) — chỉ để hiển thị. */
  maSPTheoLenh: Record<string, string[]>;
  now: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function run(
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) setError(res.error ?? "Lỗi không xác định");
      else router.refresh();
    });
  }

  return (
    // Lỗi luôn hiện trên đỉnh; các khối dữ liệu nằm trong một vùng cuộn dọc chung.
    <div className="flex h-full min-h-0 flex-col gap-3">
      {error && (
        <div className="shrink-0 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        {/* 3.5 — Bảng nguy cơ trễ (tác động tức thì) */}
        {nguyCoTre.length > 0 && (
          <section className="rounded-lg border border-red-300 bg-red-50/40 p-3">
            <h2 className="mb-2 text-sm font-semibold text-red-700">
              ⚠️ Đơn/lệnh nguy cơ trễ do sự cố ({nguyCoTre.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-1">Lệnh</th>
                    <th className="px-2 py-1">Sản phẩm / khách</th>
                    <th className="px-2 py-1">Hạn</th>
                    <th className="px-2 py-1">Dự báo xong</th>
                    <th className="px-2 py-1">Máy kẹt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {nguyCoTre.map((n) => (
                    <tr key={n.MaLenh}>
                      <td className="px-2 py-1">
                        <MaLenhHienThi
                          maLenh={n.MaLenh}
                          maLSXXuong={n.MaLSXXuong}
                          size="xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        {n.TenSanPham}
                        <span className="text-xs text-gray-400">
                          {" "}
                          · {n.KhachHang}
                        </span>
                        <div>
                          <MaSPHienThi nhan={maSPTheoLenh[n.MaLenh] ?? []} />
                        </div>
                      </td>
                      <td className="px-2 py-1">{n.HanHoanThanh || "—"}</td>
                      <td
                        className={`px-2 py-1 ${
                          n.lyDo === "vuotHan"
                            ? "font-medium text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {n.ketThucDuBao ? ngay(n.ketThucDuBao) : "—"}
                        {n.lyDo === "vuotHan" && " (vượt hạn)"}
                        {n.lyDo === "hanSat" && " (hạn sát)"}
                      </td>
                      <td className="px-2 py-1 font-mono text-xs">
                        {n.maMayKet.join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3.6b — Lệnh cần xếp lại */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            Lệnh cần xếp lại ({canXepLai.length})
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            Suy ra tự động từ phát sinh ảnh hưởng tiến độ hoặc máy đang hỏng/bảo
            trì. Xếp lại chỉ đổi công đoạn <strong>chưa xong</strong> sang máy
            hoạt động.
          </p>
          <div className="space-y-3">
            {canXepLai.map((item) => (
              <XepLaiRow
                key={item.MaLenh}
                item={item}
                may={may}
                lichAll={lichAll}
                maSP={maSPTheoLenh[item.MaLenh] ?? []}
                now={now}
                busy={busy === `xl-${item.MaLenh}`}
                onXepLai={(gan, moc) =>
                  run(`xl-${item.MaLenh}`, () =>
                    xepLaiSuCo(item.MaLenh, gan, moc),
                  )
                }
              />
            ))}
            {canXepLai.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">
                Không có lệnh nào cần xếp lại. 👍
              </p>
            )}
          </div>
        </section>

        {/* Trạng thái máy — khôi phục sau sự cố */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Trạng thái máy
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {may.map((m) => (
              <div
                key={m.MaMay}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{m.TenMay}</span>{" "}
                  <BadgeMay value={m.TrangThai} />
                </div>
                <select
                  value={m.TrangThai}
                  disabled={busy === `may-${m.MaMay}`}
                  onChange={(e) =>
                    run(`may-${m.MaMay}`, () =>
                      capNhatTrangThaiMay(
                        m.MaMay,
                        e.target.value as MayTrangThai,
                      ),
                    )
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  aria-label={`Đổi trạng thái ${m.TenMay}`}
                >
                  {(["HoatDong", "BaoTri", "Hong"] as MayTrangThai[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {NHAN_MAY_TRANG_THAI[t]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* 3.6a — Danh sách phát sinh */}
        <PhatSinhList
          phatSinh={phatSinh}
          maSPTheoLenh={maSPTheoLenh}
          busy={busy}
          onDoiTrangThai={(ma, tt) =>
            run(`ps-${ma}`, () => doiTrangThaiPhatSinh(ma, tt))
          }
        />
      </div>
    </div>
  );
}

// --- Lệnh cần xếp lại: preview + chọn máy ---

function XepLaiRow({
  item,
  may,
  lichAll,
  maSP,
  now,
  busy,
  onXepLai,
}: {
  item: CanXepLaiVM;
  may: May[];
  lichAll: LichChay[];
  /** Nhãn mã SP của lệnh — chỉ để hiển thị. */
  maSP: string[];
  now: string;
  busy: boolean;
  onXepLai: (gan: Record<string, string>, moc: string) => void;
}) {
  const [gan, setGan] = useState<Record<string, string>>({});
  const [moc, setMoc] = useState("");

  const lichCuaLenh = useMemo(
    () => lichAll.filter((l) => l.MaLenh === item.MaLenh),
    [lichAll, item.MaLenh],
  );
  const lichKhac = useMemo(
    () => lichAll.filter((l) => l.MaLenh !== item.MaLenh),
    [lichAll, item.MaLenh],
  );

  const preview = useMemo(
    () =>
      tinhLaiLichConLai({
        congDoanCanLam: parseCongDoan(item.CongDoanCanLam),
        soLuong: item.SoToIn,
        lichCuaLenh,
        may,
        lichHienCoKhac: lichKhac,
        ganMay: gan,
        mocBatDauMongMuon: moc ? moc.replace("T", " ") : undefined,
        buHaoPhanTram: item.BuHaoPhanTram,
        now: parseLocal(now),
      }),
    [item, lichCuaLenh, lichKhac, may, gan, moc, now],
  );

  const tre = treHan(preview.ketThucDuBao || null, item.HanHoanThanh);

  return (
    <div
      className={`rounded-md border p-3 ${
        tre ? "border-red-300 bg-red-50/40" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <MaLenhHienThi maLenh={item.MaLenh} maLSXXuong={item.MaLSXXuong} />
        <span className="text-sm text-gray-700">{item.TenSanPham}</span>
        <span className="text-xs text-gray-400">· {item.KhachHang}</span>
        <MaSPHienThi nhan={maSP} />
        {item.boiMayLoi && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            máy: {item.congDoanBiKet.map((c) => c.tenMay).join(", ")}
          </span>
        )}
        {item.boiPhatSinh && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            phát sinh ảnh hưởng
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Hạn: {item.HanHoanThanh || "—"} · Dự báo xong mới:{" "}
        <span className={tre ? "font-medium text-red-600" : ""}>
          {preview.ketThucDuBao ? ngay(preview.ketThucDuBao) : "—"}
        </span>
      </p>

      {/* Công đoạn đã xong (giữ nguyên) */}
      {preview.congDoanGiuNguyen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {preview.congDoanGiuNguyen.map((s) => (
            <span
              key={s.MaLich}
              className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-700"
            >
              ✓ {NHAN_CONG_DOAN[s.CongDoan]} (giữ)
            </span>
          ))}
        </div>
      )}

      {/* Công đoạn còn lại → chọn máy HoatDong */}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {preview.lichMoi.map((it, idx) => {
          const loai = CONGDOAN_MAY[it.CongDoan];
          const options = loai
            ? may.filter((m) => m.Loai === loai && m.TrangThai === "HoatDong")
            : [];
          return (
            <div
              key={`${it.CongDoan}-${idx}`}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5"
            >
              <div className="text-xs">
                <div className="font-medium text-gray-700">
                  {NHAN_CONG_DOAN[it.CongDoan]}
                </div>
                <div className="text-gray-400">
                  {gio(it.BatDauDuKien)}–{gio(it.KetThucDuKien)} ·{" "}
                  {ngay(it.BatDauDuKien)}
                </div>
              </div>
              {options.length > 0 ? (
                <select
                  value={gan[it.CongDoan] ?? it.MaMay}
                  onChange={(e) =>
                    setGan((cur) => ({ ...cur, [it.CongDoan]: e.target.value }))
                  }
                  className="rounded border border-gray-300 px-1.5 py-1 text-xs"
                  aria-label={`Máy cho ${it.CongDoan}`}
                >
                  {options.map((m) => (
                    <option key={m.MaMay} value={m.MaMay}>
                      {m.TenMay}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] text-red-500">
                  (không máy hoạt động)
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Mốc bắt đầu sớm nhất:</label>
        <input
          type="datetime-local"
          value={moc}
          onChange={(e) => setMoc(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onXepLai(gan, moc ? moc.replace("T", " ") : "")}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Đang xếp lại…" : "Xếp lại"}
        </button>
      </div>
    </div>
  );
}

// --- Danh sách phát sinh + lọc + đổi trạng thái ---

function PhatSinhList({
  phatSinh,
  maSPTheoLenh,
  busy,
  onDoiTrangThai,
}: {
  phatSinh: PhatSinhVM[];
  /** Nhãn mã SP theo MaLenh — chỉ để hiển thị. */
  maSPTheoLenh: Record<string, string[]>;
  busy: string | null;
  onDoiTrangThai: (ma: string, tt: PhatSinhTrangThai) => void;
}) {
  const [locTrangThai, setLocTrangThai] = useState<"" | PhatSinhTrangThai>("");
  const [locMucDo, setLocMucDo] = useState<"" | MucDo>("");

  const list = phatSinh.filter(
    (p) =>
      (!locTrangThai || p.TrangThai === locTrangThai) &&
      (!locMucDo || p.MucDo === locMucDo),
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700">
          Danh sách phát sinh ({list.length})
        </h2>
        <div className="flex gap-2">
          <select
            value={locTrangThai}
            onChange={(e) =>
              setLocTrangThai(e.target.value as "" | PhatSinhTrangThai)
            }
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">Mọi trạng thái</option>
            <option value="Moi">Mới</option>
            <option value="DangXuLy">Đang xử lý</option>
            <option value="DaXong">Đã xong</option>
          </select>
          <select
            value={locMucDo}
            onChange={(e) => setLocMucDo(e.target.value as "" | MucDo)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">Mọi mức độ</option>
            <option value="Nhe">Nhẹ</option>
            <option value="TrungBinh">Trung bình</option>
            <option value="NghiemTrong">Nghiêm trọng</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((p) => (
          <div
            key={p.MaPhatSinh}
            className="rounded-md border border-gray-200 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{p.MaPhatSinh}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {NHAN_PHAT_SINH_LOAI[p.Loai]}
              </span>
              <BadgeMucDo value={p.MucDo} />
              <BadgePhatSinh value={p.TrangThai} />
              {p.AnhHuongTienDo && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  ảnh hưởng tiến độ
                </span>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {p.ThoiGian}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-800">{p.MoTa}</p>
            <p className="text-xs text-gray-500">
              <Link
                href={`/tien-do/${p.MaLenh}`}
                className="hover:underline"
                title="Mở tiến độ lệnh"
              >
                <MaLenhHienThi
                  maLenh={p.MaLenh}
                  maLSXXuong={p.MaLSXXuong}
                  size="xs"
                />
              </Link>{" "}
              · {p.TenSanPham} ({p.KhachHang}) ·{" "}
              <MaSPHienThi nhan={maSPTheoLenh[p.MaLenh] ?? []} />
              {p.HuongXuLy && ` · Xử lý: ${p.HuongXuLy}`}
            </p>

            <div className="mt-2 flex gap-1">
              {(["Moi", "DangXuLy", "DaXong"] as PhatSinhTrangThai[]).map(
                (tt) => (
                  <button
                    key={tt}
                    type="button"
                    disabled={
                      busy === `ps-${p.MaPhatSinh}` || p.TrangThai === tt
                    }
                    onClick={() => onDoiTrangThai(p.MaPhatSinh, tt)}
                    className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                      p.TrangThai === tt
                        ? "border-brand bg-blue-50 text-brand"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tt === "Moi"
                      ? "Mới"
                      : tt === "DangXuLy"
                        ? "Đang xử lý"
                        : "Đã xong"}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Không có phát sinh phù hợp bộ lọc.
          </p>
        )}
      </div>
    </section>
  );
}
