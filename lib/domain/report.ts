/**
 * Báo cáo (THUẦN, chỉ ĐỌC/tổng hợp; không import "server-only").
 *
 * Mọi số liệu SUY RA realtime từ các sheet — không lưu bảng báo cáo.
 * Tái sử dụng: assist.tinhTaiMay (tải máy), reschedule.danhSachNguyCoTre (máy hỏng),
 * assist.treHan (lịch vượt hạn), schedule.parseCongDoan.
 *
 * Mốc hoàn thành suy từ TienDo:
 *  - Xong một công đoạn = ThoiGian của dòng TienDo mới nhất có TrangThaiMoi="Xong".
 *  - Xong cả lệnh = khi MỌI công đoạn trong CongDoanCanLam đều có dòng Xong (lấy max ThoiGian).
 */

import type { MucDo, PhatSinhLoai } from "./enums";
import type {
  DonHang,
  LenhSanXuat,
  LichChay,
  May,
  PhatSinh,
  TienDo,
} from "./types";
import { parseCongDoan } from "./schedule";
import { tinhTaiMay, treHan, type TaiMay } from "./assist";
import { danhSachNguyCoTre } from "./reschedule";
import { parseLocal, soNgayGiua } from "./datetime";
import { NGUONG_NGHEN_MAY } from "./config";

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const a = m.get(k) ?? [];
    a.push(item);
    m.set(k, a);
  }
  return m;
}

// --- Mốc hoàn thành suy từ TienDo ---

/** Thời điểm hoàn thành cả lệnh; null nếu còn công đoạn chưa có dòng "Xong". */
export function thoiDiemHoanThanhLenh(
  congDoanCanLam: string[],
  tienDoCuaLenh: TienDo[],
): string | null {
  if (congDoanCanLam.length === 0) return null;
  let maxTime = "";
  for (const cd of congDoanCanLam) {
    const xong = tienDoCuaLenh.filter(
      (t) => t.CongDoan === cd && t.TrangThaiMoi === "Xong",
    );
    if (xong.length === 0) return null;
    const latest = xong.reduce((m, t) => (t.ThoiGian > m ? t.ThoiGian : m), "");
    if (latest > maxTime) maxTime = latest;
  }
  return maxTime || null;
}

/** Thời điểm hoàn thành cả đơn = khi mọi lệnh của đơn đã xong (max); null nếu chưa. */
export function thoiDiemHoanThanhDon(
  lenhsCuaDon: LenhSanXuat[],
  tienDoByLenh: Map<string, TienDo[]>,
): string | null {
  if (lenhsCuaDon.length === 0) return null;
  let maxTime = "";
  for (const l of lenhsCuaDon) {
    const done = thoiDiemHoanThanhLenh(
      parseCongDoan(l.CongDoanCanLam),
      tienDoByLenh.get(l.MaLenh) ?? [],
    );
    if (!done) return null;
    if (done > maxTime) maxTime = done;
  }
  return maxTime || null;
}

// ---------------------------------------------------------------------------
// 4.1 — Báo cáo ngày
// ---------------------------------------------------------------------------

export interface LenhXongVM {
  MaLenh: string;
  MaDon: string;
  TenSanPham: string;
  KhachHang: string;
  thoiDiem: string;
}
export interface DangChayVM {
  MaLenh: string;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  congDoanHienTai: string | null;
}
export interface NguyCoTreVM {
  MaLenh: string;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  ketThucDuKien: string;
  boiMay: boolean;
  boiLich: boolean;
  phatSinhMo: { Loai: PhatSinhLoai; MoTa: string }[];
}
export interface BaoCaoNgay {
  ngay: string;
  daXongLenh: LenhXongVM[];
  soDonXong: number;
  dangChay: DangChayVM[];
  nguyCoTre: NguyCoTreVM[];
}

export function baoCaoNgay(params: {
  ngay: string;
  lenhs: LenhSanXuat[];
  dons: DonHang[];
  lichAll: LichChay[];
  tienDoAll: TienDo[];
  phatSinhAll: PhatSinh[];
  mayList: May[];
  now: Date;
  homNay: string;
}): BaoCaoNgay {
  const { ngay, lenhs, dons, lichAll, tienDoAll, phatSinhAll, mayList, now, homNay } =
    params;
  const donMap = new Map(dons.map((d) => [d.MaDon, d]));
  const lichByLenh = groupBy(lichAll, (l) => l.MaLenh);
  const tienDoByLenh = groupBy(tienDoAll, (t) => t.MaLenh);
  const psByLenh = groupBy(phatSinhAll, (p) => p.MaLenh);
  const lenhsByDon = groupBy(lenhs, (l) => l.MaDon);

  // Đã xong trong ngày (lệnh)
  const daXongLenh: LenhXongVM[] = [];
  for (const l of lenhs) {
    const done = thoiDiemHoanThanhLenh(
      parseCongDoan(l.CongDoanCanLam),
      tienDoByLenh.get(l.MaLenh) ?? [],
    );
    if (done && done.slice(0, 10) === ngay) {
      const d = donMap.get(l.MaDon);
      daXongLenh.push({
        MaLenh: l.MaLenh,
        MaDon: l.MaDon,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
        thoiDiem: done,
      });
    }
  }

  // Đơn xong trong ngày
  let soDonXong = 0;
  for (const d of dons) {
    const done = thoiDiemHoanThanhDon(lenhsByDon.get(d.MaDon) ?? [], tienDoByLenh);
    if (done && done.slice(0, 10) === ngay) soDonXong++;
  }

  // Đang chạy
  const dangChay: DangChayVM[] = [];
  for (const l of lenhs) {
    if (l.TrangThai === "HoanThanh") continue;
    const lich = lichByLenh.get(l.MaLenh) ?? [];
    const running =
      l.TrangThai === "DangChay" || lich.some((x) => x.TrangThai === "DangChay");
    if (running) {
      const d = donMap.get(l.MaDon);
      const cur = lich
        .slice()
        .sort((a, b) => (a.BatDauDuKien < b.BatDauDuKien ? -1 : 1))
        .find((x) => x.TrangThai !== "Xong");
      dangChay.push({
        MaLenh: l.MaLenh,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
        HanHoanThanh: l.HanHoanThanh,
        congDoanHienTai: cur?.CongDoan ?? null,
      });
    }
  }

  // Nguy cơ trễ = máy hỏng ∪ lịch vượt hạn
  const map = new Map<string, NguyCoTreVM>();
  for (const n of danhSachNguyCoTre({ lenhs, lichAll, mayList, donMap, now, homNay })) {
    map.set(n.MaLenh, {
      MaLenh: n.MaLenh,
      TenSanPham: n.TenSanPham,
      KhachHang: n.KhachHang,
      HanHoanThanh: n.HanHoanThanh,
      ketThucDuKien: n.ketThucDuBao,
      boiMay: true,
      boiLich: false,
      phatSinhMo: [],
    });
  }
  for (const l of lenhs) {
    if (l.TrangThai === "HoanThanh") continue;
    const lich = lichByLenh.get(l.MaLenh) ?? [];
    if (lich.length === 0) continue;
    const ketThucCuoi = lich.reduce(
      (m, k) => (k.KetThucDuKien > m ? k.KetThucDuKien : m),
      "",
    );
    if (treHan(ketThucCuoi || null, l.HanHoanThanh)) {
      const existing = map.get(l.MaLenh);
      if (existing) {
        existing.boiLich = true;
      } else {
        const d = donMap.get(l.MaDon);
        map.set(l.MaLenh, {
          MaLenh: l.MaLenh,
          TenSanPham: d?.TenSanPham ?? "",
          KhachHang: d?.KhachHang ?? "",
          HanHoanThanh: l.HanHoanThanh,
          ketThucDuKien: ketThucCuoi,
          boiMay: false,
          boiLich: true,
          phatSinhMo: [],
        });
      }
    }
  }
  for (const [maLenh, vm] of map) {
    vm.phatSinhMo = (psByLenh.get(maLenh) ?? [])
      .filter((p) => p.TrangThai !== "DaXong")
      .map((p) => ({ Loai: p.Loai, MoTa: p.MoTa }));
  }
  const nguyCoTre = [...map.values()].sort((a, b) =>
    (a.HanHoanThanh || "9999") < (b.HanHoanThanh || "9999") ? -1 : 1,
  );

  return { ngay, daXongLenh, soDonXong, dangChay, nguyCoTre };
}

// ---------------------------------------------------------------------------
// 4.2 — Tải máy theo tuần
// ---------------------------------------------------------------------------

export interface TaiMayVM extends TaiMay {
  TenMay: string;
  Loai: string;
  nghen: boolean;
}

export function taiMayTheoTuan(params: {
  from: string;
  to: string;
  may: May[];
  lichAll: LichChay[];
}): { items: TaiMayVM[]; maxTai: number } {
  const fromD = parseLocal(`${params.from} 00:00`);
  const toD = parseLocal(`${params.to} 23:59`);
  const tai = tinhTaiMay(params.may, params.lichAll, fromD, toD);
  const mayMap = new Map(params.may.map((m) => [m.MaMay, m]));
  const maxTai = tai.reduce((m, t) => Math.max(m, t.tai), 0);
  const items = tai
    .map((t) => {
      const m = mayMap.get(t.maMay);
      return {
        ...t,
        TenMay: m?.TenMay ?? t.maMay,
        Loai: m?.Loai ?? "",
        nghen: t.tai >= NGUONG_NGHEN_MAY,
      };
    })
    .sort((a, b) => b.tai - a.tai);
  return { items, maxTai };
}

// ---------------------------------------------------------------------------
// 4.3 — Tỷ lệ đúng hạn theo tháng
// ---------------------------------------------------------------------------

export interface DonTreVM {
  MaDon: string;
  KhachHang: string;
  NgayGiaoHang: string;
  ngayHoanThanh: string | null;
  soNgayTre: number;
}
export interface TyLeDungHan {
  thang: string;
  tong: number;
  dungHan: number;
  tre: number;
  tyLe: number;
  danhSachTre: DonTreVM[];
}

export function tyLeDungHan(params: {
  thang: string; // "YYYY-MM"
  dons: DonHang[];
  lenhs: LenhSanXuat[];
  tienDoAll: TienDo[];
  homNay: string;
}): TyLeDungHan {
  const { thang, dons, lenhs, tienDoAll, homNay } = params;
  const lenhsByDon = groupBy(lenhs, (l) => l.MaDon);
  const tienDoByLenh = groupBy(tienDoAll, (t) => t.MaLenh);

  let dungHan = 0;
  let tre = 0;
  const danhSachTre: DonTreVM[] = [];
  const daXet = new Set<string>();

  for (const d of dons) {
    const done = thoiDiemHoanThanhDon(lenhsByDon.get(d.MaDon) ?? [], tienDoByLenh);
    if (!done || done.slice(0, 7) !== thang) continue;
    daXet.add(d.MaDon);
    const doneDate = done.slice(0, 10);
    const late = d.NgayGiaoHang ? doneDate > d.NgayGiaoHang : false;
    if (late) {
      tre++;
      danhSachTre.push({
        MaDon: d.MaDon,
        KhachHang: d.KhachHang,
        NgayGiaoHang: d.NgayGiaoHang,
        ngayHoanThanh: doneDate,
        soNgayTre: Math.max(0, soNgayGiua(d.NgayGiaoHang, doneDate)),
      });
    } else {
      dungHan++;
    }
  }

  // Đơn đang TreHen có hạn trong tháng nhưng chưa hoàn thành → tính là trễ.
  for (const d of dons) {
    if (daXet.has(d.MaDon)) continue;
    if (d.TrangThai === "TreHen" && d.NgayGiaoHang.slice(0, 7) === thang) {
      tre++;
      danhSachTre.push({
        MaDon: d.MaDon,
        KhachHang: d.KhachHang,
        NgayGiaoHang: d.NgayGiaoHang,
        ngayHoanThanh: null,
        soNgayTre: Math.max(0, soNgayGiua(d.NgayGiaoHang, homNay)),
      });
    }
  }

  const tong = dungHan + tre;
  return {
    thang,
    tong,
    dungHan,
    tre,
    tyLe: tong > 0 ? Math.round((dungHan / tong) * 100) : 0,
    danhSachTre: danhSachTre.sort((a, b) => b.soNgayTre - a.soNgayTre),
  };
}

// ---------------------------------------------------------------------------
// 4.4 — Thống kê phát sinh
// ---------------------------------------------------------------------------

export interface ThongKePhatSinh {
  tong: number;
  theoLoai: { loai: PhatSinhLoai; soLuong: number }[];
  theoMucDo: { mucDo: MucDo; soLuong: number }[];
  soAnhHuong: number;
  phanTramAnhHuong: number;
}

export function thongKePhatSinh(params: {
  from: string;
  to: string;
  phatSinhAll: PhatSinh[];
}): ThongKePhatSinh {
  const inRange = params.phatSinhAll.filter((p) => {
    const d = p.ThoiGian.slice(0, 10);
    return d >= params.from && d <= params.to;
  });
  const loaiMap = new Map<PhatSinhLoai, number>();
  const mucMap = new Map<MucDo, number>();
  let soAnhHuong = 0;
  for (const p of inRange) {
    loaiMap.set(p.Loai, (loaiMap.get(p.Loai) ?? 0) + 1);
    mucMap.set(p.MucDo, (mucMap.get(p.MucDo) ?? 0) + 1);
    if (p.AnhHuongTienDo) soAnhHuong++;
  }
  const tong = inRange.length;
  return {
    tong,
    theoLoai: [...loaiMap.entries()]
      .map(([loai, soLuong]) => ({ loai, soLuong }))
      .sort((a, b) => b.soLuong - a.soLuong),
    theoMucDo: [...mucMap.entries()]
      .map(([mucDo, soLuong]) => ({ mucDo, soLuong }))
      .sort((a, b) => b.soLuong - a.soLuong),
    soAnhHuong,
    phanTramAnhHuong: tong > 0 ? Math.round((soAnhHuong / tong) * 100) : 0,
  };
}
