"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CongDoan, DoUuTien, LichTrangThai } from "@/lib/domain/enums";
import type { May } from "@/lib/domain/types";
import { CONGDOAN_MAY } from "@/lib/domain/config";
import {
  parseCongDoan,
  tinhLichChoLenh,
} from "@/lib/domain/schedule";
import {
  khoaDangGom,
  khoaGom,
  tinhTaiMay,
  treHan,
} from "@/lib/domain/assist";
import {
  addDaysLocal,
  formatDateLocal,
  parseLocal,
} from "@/lib/domain/datetime";
import { NHAN_CONG_DOAN, NHAN_MAY_LOAI } from "@/lib/domain/labels";
import { BadgeLich, BadgeUuTien } from "@/components/status-badge";
import { xepLaiLenh, xepLenh } from "./actions";

// --- View models (dựng ở page.tsx, server) ---

export interface ChoXepVM {
  MaLenh: string;
  MaDon: string;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  DoUuTien: DoUuTien;
  CongDoanCanLam: string;
  SoLuong: number;
  SoMau: string;
  LoaiGiay: string;
  KhoThanhPham: string;
}

export interface LichVM {
  MaLich: string;
  MaLenh: string;
  CongDoan: CongDoan;
  MaMay: string;
  ThuTu: number;
  BatDauDuKien: string;
  KetThucDuKien: string;
  TrangThai: LichTrangThai;
  NguoiPhuTrach: string;
  NguoiCapNhat: string;
  NgayCapNhat: string;
  // joined:
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  DoUuTien: DoUuTien;
  SoMau: string;
  LoaiGiay: string;
  KhoThanhPham: string;
}

const UU_TIEN_RANK: Record<DoUuTien, number> = {
  Gap: 0,
  Cao: 1,
  BinhThuong: 2,
  Thap: 3,
};

/** "YYYY-MM-DD HH:mm" → "HH:mm". */
function gio(s: string): string {
  return s.length >= 16 ? s.slice(11, 16) : s;
}
/** "YYYY-MM-DD HH:mm" → "YYYY-MM-DD". */
function ngay(s: string): string {
  return s.slice(0, 10);
}

/** Màu ổn định cho một khóa gom (viền nhấn). */
const GOM_COLORS = [
  "border-l-pink-400",
  "border-l-purple-400",
  "border-l-cyan-400",
  "border-l-orange-400",
  "border-l-lime-500",
  "border-l-fuchsia-400",
];
function gomColor(key: string, keys: string[]): string {
  const i = keys.indexOf(key);
  return i >= 0 ? (GOM_COLORS[i % GOM_COLORS.length] as string) : "";
}

export function Board({
  may,
  lich,
  choXep,
  now,
}: {
  may: May[];
  lich: LichVM[];
  choXep: ChoXepVM[];
  now: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyLenh, setBusyLenh] = useState<Set<string>>(new Set());
  // Lệnh vừa bấm xếp (optimistic ẩn khỏi panel chờ ngay).
  const [danAn, setDanAn] = useState<Set<string>>(new Set());
  const [dragLenh, setDragLenh] = useState<string | null>(null);
  const homNay = now.slice(0, 10); // server cấp → tất định, tránh hydration mismatch
  const [ngayXem, setNgayXem] = useState<string>(homNay);

  const nowDate = useMemo(() => parseLocal(now), [now]);

  // Gom màu/khổ (2.7): tính trên toàn bộ lệnh (chờ + đã xếp theo lệnh).
  const gomKeys = useMemo(() => {
    const items = [
      ...choXep.map((c) => ({
        SoMau: c.SoMau,
        LoaiGiay: c.LoaiGiay,
        KhoThanhPham: c.KhoThanhPham,
      })),
      ...dedupeLenh(lich).map((l) => ({
        SoMau: l.SoMau,
        LoaiGiay: l.LoaiGiay,
        KhoThanhPham: l.KhoThanhPham,
      })),
    ];
    const set = khoaDangGom(items);
    return [...set];
  }, [choXep, lich]);

  // Tải máy (2.8) trong ngày đang xem.
  const taiMay = useMemo(() => {
    const from = parseLocal(`${ngayXem} 00:00`);
    const to = parseLocal(`${ngayXem} 23:59`);
    const map = new Map<string, number>();
    for (const t of tinhTaiMay(may, lich, from, to)) map.set(t.maMay, t.tai);
    return map;
  }, [may, lich, ngayXem]);

  const choXepSorted = useMemo(() => {
    return [...choXep]
      .filter((c) => !danAn.has(c.MaLenh))
      .sort((a, b) => {
        const ha = a.HanHoanThanh || "9999-99-99";
        const hb = b.HanHoanThanh || "9999-99-99";
        if (ha !== hb) return ha < hb ? -1 : 1;
        return UU_TIEN_RANK[a.DoUuTien] - UU_TIEN_RANK[b.DoUuTien];
      });
  }, [choXep, danAn]);

  function runXep(maLenh: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusyLenh((s) => new Set(s).add(maLenh));
    setDanAn((s) => new Set(s).add(maLenh));
    startTransition(async () => {
      const res = await fn();
      setBusyLenh((s) => {
        const n = new Set(s);
        n.delete(maLenh);
        return n;
      });
      if (!res.ok) {
        setDanAn((s) => {
          const n = new Set(s);
          n.delete(maLenh);
          return n;
        });
        setError(`Không xếp được ${maLenh}: ${res.error ?? ""}`);
      } else {
        router.refresh();
      }
    });
  }

  // Kéo lệnh chờ thả vào cột máy → ép công đoạn khớp loại máy vào máy đó.
  function thaVaoMay(maLenh: string, m: May) {
    const item = choXep.find((c) => c.MaLenh === maLenh);
    if (!item) return;
    const cds = parseCongDoan(item.CongDoanCanLam);
    const cdKhop = cds.find((cd) => CONGDOAN_MAY[cd] === m.Loai);
    const ganMay = cdKhop ? { [cdKhop]: m.MaMay } : undefined;
    runXep(maLenh, () => xepLenh(maLenh, ganMay));
  }

  const lenhDaXep = useMemo(() => groupLenh(lich), [lich]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Panel lệnh chờ xếp (2.3) */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            Lệnh chờ xếp ({choXepSorted.length})
          </h2>
          <p className="mb-3 text-xs text-gray-400">
            Chỉ lệnh đã <strong>Sẵn sàng</strong>, sắp theo hạn rồi ưu tiên. Bấm
            “Xếp lịch” (tự chọn máy nhanh nhất) hoặc kéo thả vào cột máy.
          </p>
          <div className="space-y-2">
            {choXepSorted.map((c) => {
              const preview = tinhLichChoLenh({
                congDoanCanLam: parseCongDoan(c.CongDoanCanLam),
                soLuong: c.SoLuong,
                may,
                lichHienCo: lich,
                now: nowDate,
              });
              const ketThuc = preview.reduce(
                (m, k) => (k.KetThucDuKien > m ? k.KetThucDuKien : m),
                "",
              );
              const tre = treHan(ketThuc || null, c.HanHoanThanh);
              const key = khoaGom(c);
              const border = gomColor(key, gomKeys);
              return (
                <div
                  key={c.MaLenh}
                  draggable
                  onDragStart={() => setDragLenh(c.MaLenh)}
                  onDragEnd={() => setDragLenh(null)}
                  className={`cursor-grab rounded-md border border-gray-200 bg-white p-2.5 shadow-sm active:cursor-grabbing ${
                    border ? `border-l-4 ${border}` : ""
                  } ${tre ? "ring-1 ring-red-300" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{c.MaLenh}</span>
                    <BadgeUuTien value={c.DoUuTien} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {c.TenSanPham || "—"}
                  </p>
                  <p className="text-xs text-gray-500">{c.KhachHang}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parseCongDoan(c.CongDoanCanLam).map((cd, i) => (
                      <span
                        key={`${cd}-${i}`}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                      >
                        {i + 1}.{NHAN_CONG_DOAN[cd] ?? cd}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Hạn: {c.HanHoanThanh || "—"}
                  </p>
                  {tre ? (
                    <p className="mt-0.5 text-xs font-medium text-red-600">
                      ⚠️ Xếp bây giờ dự kiến TRỄ (xong ~{ngay(ketThuc)})
                    </p>
                  ) : (
                    ketThuc && (
                      <p className="mt-0.5 text-xs text-green-700">
                        Dự kiến xong ~{ngay(ketThuc)}
                      </p>
                    )
                  )}
                  <button
                    type="button"
                    disabled={busyLenh.has(c.MaLenh)}
                    onClick={() => runXep(c.MaLenh, () => xepLenh(c.MaLenh))}
                    className="mt-2 w-full rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {busyLenh.has(c.MaLenh) ? "Đang xếp…" : "Xếp lịch"}
                  </button>
                </div>
              );
            })}
            {choXepSorted.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">
                Không có lệnh chờ xếp. (Lệnh phải ở trạng thái “Sẵn sàng” tại
                Chế bản.)
              </p>
            )}
          </div>
        </section>

        {/* Planning Board (2.4) */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Bảng xếp lịch theo máy
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setNgayXem(formatDateLocal(addDaysLocal(parseLocal(ngayXem), -1)))
                }
                className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
                aria-label="Ngày trước"
              >
                ◀
              </button>
              <input
                type="date"
                value={ngayXem}
                onChange={(e) => setNgayXem(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setNgayXem(formatDateLocal(addDaysLocal(parseLocal(ngayXem), 1)))
                }
                className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
                aria-label="Ngày sau"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() => setNgayXem(homNay)}
                className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
              >
                Hôm nay
              </button>
            </div>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
            }}
          >
            {may.map((m) => {
                const blocks = lich
                  .filter(
                    (l) =>
                      l.MaMay === m.MaMay &&
                      ngay(l.BatDauDuKien) <= ngayXem &&
                      ngay(l.KetThucDuKien) >= ngayXem,
                  )
                  .sort((a, b) => (a.BatDauDuKien < b.BatDauDuKien ? -1 : 1));
                const tai = taiMay.get(m.MaMay) ?? 0;
                const laHaLuu = m.Loai === "Be" || m.Loai === "Dan";
                return (
                  <div
                    key={m.MaMay}
                    onDragOver={(e) => {
                      if (dragLenh) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragLenh) thaVaoMay(dragLenh, m);
                      setDragLenh(null);
                    }}
                    className={`flex min-h-[8rem] flex-col rounded-md border ${
                      dragLenh ? "border-brand/50 bg-blue-50/40" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="border-b border-gray-200 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-gray-700">
                          {m.TenMay}
                        </span>
                        <span
                          className={`rounded px-1 text-[11px] ${
                            tai > 1
                              ? "bg-red-100 text-red-700"
                              : tai > 0.8
                                ? "bg-amber-100 text-amber-800"
                                : "bg-white text-gray-500"
                          }`}
                        >
                          {Math.round(tai * 100)}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {NHAN_MAY_LOAI[m.Loai]}
                        {m.TrangThai !== "HoatDong" && (
                          <span className="ml-1 text-red-500">
                            ({m.TrangThai})
                          </span>
                        )}
                      </div>
                      {laHaLuu && tai > 1 && (
                        <div className="mt-0.5 text-[11px] font-medium text-red-600">
                          ⚠️ Dồn công đoạn sau
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-1.5">
                      {blocks.map((b) => (
                        <div
                          key={b.MaLich}
                          className={`rounded border-l-4 bg-white p-1.5 text-[11px] shadow-sm ${
                            treHan(
                              lich
                                .filter((x) => x.MaLenh === b.MaLenh)
                                .reduce(
                                  (mm, k) =>
                                    k.KetThucDuKien > mm ? k.KetThucDuKien : mm,
                                  "",
                                ) || null,
                              b.HanHoanThanh,
                            )
                              ? "border-l-red-500"
                              : "border-l-brand"
                          }`}
                          title={`${b.MaLenh} · ${b.TenSanPham}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{b.MaLenh}</span>
                            <span className="text-gray-500">
                              #{b.ThuTu}
                            </span>
                          </div>
                          <div className="font-medium text-gray-800">
                            {NHAN_CONG_DOAN[b.CongDoan]}
                          </div>
                          <div className="text-gray-500">
                            {gio(b.BatDauDuKien)}–{gio(b.KetThucDuKien)}
                          </div>
                          <div className="mt-0.5">
                            <BadgeLich value={b.TrangThai} />
                          </div>
                        </div>
                      ))}
                      {blocks.length === 0 && (
                        <p className="py-4 text-center text-[11px] text-gray-300">
                          (trống)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          {gomKeys.length > 0 && (
            <p className="mt-2 text-[11px] text-gray-400">
              Viền màu bên trái = các lệnh cùng số màu/khổ/giấy — nên xếp liền
              nhau để giảm make-ready.
            </p>
          )}
        </section>
      </div>

      {/* Lệnh đã xếp — xếp lại / gán lại máy (2.5 fallback) */}
      <ScheduledSection
        groups={lenhDaXep}
        may={may}
        busyLenh={busyLenh}
        onXepLai={(maLenh, ganMay, mocBatDau) =>
          runXep(maLenh, () => xepLaiLenh(maLenh, ganMay, mocBatDau))
        }
      />
    </div>
  );
}

// --- Nhóm lịch theo lệnh ---

interface LenhGroup {
  MaLenh: string;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  DoUuTien: DoUuTien;
  stages: LichVM[];
  ketThucCuoi: string;
  tre: boolean;
}

function groupLenh(lich: LichVM[]): LenhGroup[] {
  const map = new Map<string, LichVM[]>();
  for (const l of lich) {
    const arr = map.get(l.MaLenh) ?? [];
    arr.push(l);
    map.set(l.MaLenh, arr);
  }
  const groups: LenhGroup[] = [];
  for (const [maLenh, stages] of map) {
    stages.sort((a, b) => (a.BatDauDuKien < b.BatDauDuKien ? -1 : 1));
    const first = stages[0]!;
    const ketThucCuoi = stages.reduce(
      (m, k) => (k.KetThucDuKien > m ? k.KetThucDuKien : m),
      "",
    );
    groups.push({
      MaLenh: maLenh,
      TenSanPham: first.TenSanPham,
      KhachHang: first.KhachHang,
      HanHoanThanh: first.HanHoanThanh,
      DoUuTien: first.DoUuTien,
      stages,
      ketThucCuoi,
      tre: treHan(ketThucCuoi || null, first.HanHoanThanh),
    });
  }
  return groups.sort((a, b) => (a.ketThucCuoi < b.ketThucCuoi ? -1 : 1));
}

/** Một dòng đại diện mỗi lệnh (để tính gom màu không đếm trùng theo công đoạn). */
function dedupeLenh(lich: LichVM[]): LichVM[] {
  const seen = new Set<string>();
  const out: LichVM[] = [];
  for (const l of lich) {
    if (seen.has(l.MaLenh)) continue;
    seen.add(l.MaLenh);
    out.push(l);
  }
  return out;
}

function ScheduledSection({
  groups,
  may,
  busyLenh,
  onXepLai,
}: {
  groups: LenhGroup[];
  may: May[];
  busyLenh: Set<string>;
  onXepLai: (
    maLenh: string,
    ganMay: Record<string, string>,
    mocBatDau: string,
  ) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Lệnh đã xếp ({groups.length})
      </h2>
      <p className="mb-3 text-xs text-gray-400">
        Đổi máy cho từng công đoạn hoặc dời mốc bắt đầu rồi bấm “Tính lại lịch”.
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <LenhRow
            key={g.MaLenh}
            group={g}
            may={may}
            busy={busyLenh.has(g.MaLenh)}
            onXepLai={onXepLai}
          />
        ))}
      </div>
    </section>
  );
}

function LenhRow({
  group,
  may,
  busy,
  onXepLai,
}: {
  group: LenhGroup;
  may: May[];
  busy: boolean;
  onXepLai: (
    maLenh: string,
    ganMay: Record<string, string>,
    mocBatDau: string,
  ) => void;
}) {
  // Khởi tạo lựa chọn máy từ lịch hiện có.
  const [gan, setGan] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {};
    for (const s of group.stages) if (s.MaMay) g[s.CongDoan] = s.MaMay;
    return g;
  });
  const [moc, setMoc] = useState<string>("");

  return (
    <div
      className={`rounded-md border p-3 ${
        group.tre ? "border-red-300 bg-red-50/40" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{group.MaLenh}</span>
        <BadgeUuTien value={group.DoUuTien} />
        <span className="text-sm text-gray-700">{group.TenSanPham}</span>
        <span className="text-xs text-gray-400">· {group.KhachHang}</span>
        {group.tre && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            ⚠️ Trễ hạn (xong {group.ketThucCuoi} &gt; hạn {group.HanHoanThanh})
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.stages.map((s) => {
          const loai = CONGDOAN_MAY[s.CongDoan];
          const options = loai
            ? may.filter((m) => m.Loai === loai)
            : [];
          return (
            <div
              key={s.MaLich}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5"
            >
              <div className="text-xs">
                <div className="font-medium text-gray-700">
                  {NHAN_CONG_DOAN[s.CongDoan]}
                </div>
                <div className="text-gray-400">
                  {gio(s.BatDauDuKien)}–{gio(s.KetThucDuKien)} · {ngay(s.BatDauDuKien)}
                </div>
              </div>
              {options.length > 0 ? (
                <select
                  value={gan[s.CongDoan] ?? s.MaMay}
                  onChange={(e) =>
                    setGan((cur) => ({ ...cur, [s.CongDoan]: e.target.value }))
                  }
                  className="rounded border border-gray-300 px-1.5 py-1 text-xs"
                  aria-label={`Máy cho ${s.CongDoan}`}
                >
                  {options.map((m) => (
                    <option key={m.MaMay} value={m.MaMay}>
                      {m.TenMay}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] text-gray-400">
                  {s.MaMay || "(không máy chuyên)"}
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
          onClick={() =>
            onXepLai(group.MaLenh, gan, moc ? moc.replace("T", " ") : "")
          }
          className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-blue-50 disabled:opacity-60"
        >
          {busy ? "Đang tính…" : "Tính lại lịch"}
        </button>
      </div>
    </div>
  );
}
