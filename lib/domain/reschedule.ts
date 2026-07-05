/**
 * Logic phát sinh & sắp xếp lại (THUẦN, không import "server-only").
 *
 *  A. danhSachCanXepLai  — suy ra ĐỘNG lệnh cần xếp lại (không lưu cột riêng).
 *  B. tinhLaiLichConLai  — tính lại CHỈ công đoạn chưa Xong, giữ nguyên đã Xong.
 *  C. danhSachNguyCoTre  — bảng tác động tức thì khi có sự cố (đặc biệt hỏng máy).
 *
 * Nguyên tắc:
 *  - "Cần xếp lại" là trạng thái SUY RA ở tầng app, KHÔNG thêm giá trị enum.
 *  - Sự cố hỏng máy thể hiện qua May.TrangThai (BaoTri/Hong), không thêm cột.
 *  - Không đụng công đoạn đã Xong; xếp lại chỉ tính máy đang HoatDong.
 */

import type { CongDoan, MayTrangThai } from "./enums";
import type { DonHang, LenhSanXuat, LichChay, May, PhatSinh } from "./types";
import { parseCongDoan, tinhLichChoLenh, type LichChayTinh } from "./schedule";
import { treHan } from "./assist";
import { soNgayGiua } from "./datetime";
import { DE_DOA_TRE_NGAY } from "./config";

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

// ---------------------------------------------------------------------------
// A. Suy ra lệnh cần xếp lại
// ---------------------------------------------------------------------------

/** Một công đoạn (LichChay) chưa xong đang kẹt trên máy không HoatDong. */
export interface CongDoanKet {
  MaLich: string;
  CongDoan: CongDoan;
  MaMay: string;
  tenMay: string;
  mayTrangThai: MayTrangThai;
}

export interface LyDoXepLai {
  /** Có PhatSinh AnhHuongTienDo và chưa DaXong. */
  boiPhatSinh: boolean;
  /** Có công đoạn chưa Xong nằm trên máy BaoTri/Hong. */
  boiMayLoi: boolean;
  maPhatSinh: string[];
  congDoanBiKet: CongDoanKet[];
}

/**
 * Lý do một lệnh cần xếp lại — null nếu không cần. Chỉ xét lệnh đã có lịch và
 * chưa Hoàn thành (lệnh chưa xếp lịch thuộc luồng /xep-lich bình thường).
 */
export function lyDoCanXepLai(
  lenh: LenhSanXuat,
  phatSinhCuaLenh: PhatSinh[],
  lichCuaLenh: LichChay[],
  mayMap: Map<string, May>,
): LyDoXepLai | null {
  if (lenh.TrangThai === "HoanThanh") return null;
  if (lichCuaLenh.length === 0) return null;

  const psAnhHuong = phatSinhCuaLenh.filter(
    (p) => p.AnhHuongTienDo && p.TrangThai !== "DaXong",
  );

  const congDoanBiKet: CongDoanKet[] = [];
  for (const l of lichCuaLenh) {
    if (l.TrangThai === "Xong" || !l.MaMay) continue;
    const m = mayMap.get(l.MaMay);
    if (m && m.TrangThai !== "HoatDong") {
      congDoanBiKet.push({
        MaLich: l.MaLich,
        CongDoan: l.CongDoan,
        MaMay: l.MaMay,
        tenMay: m.TenMay,
        mayTrangThai: m.TrangThai,
      });
    }
  }

  const boiPhatSinh = psAnhHuong.length > 0;
  const boiMayLoi = congDoanBiKet.length > 0;
  if (!boiPhatSinh && !boiMayLoi) return null;
  return {
    boiPhatSinh,
    boiMayLoi,
    maPhatSinh: psAnhHuong.map((p) => p.MaPhatSinh),
    congDoanBiKet,
  };
}

export interface LenhCanXepLai {
  lenh: LenhSanXuat;
  lyDo: LyDoXepLai;
}

/** Toàn bộ lệnh cần xếp lại (suy ra động từ PhatSinh + trạng thái máy). */
export function danhSachCanXepLai(
  lenhs: LenhSanXuat[],
  phatSinhs: PhatSinh[],
  lichAll: LichChay[],
  mayList: May[],
): LenhCanXepLai[] {
  const mayMap = new Map(mayList.map((m) => [m.MaMay, m]));
  const psByLenh = groupBy(phatSinhs, (p) => p.MaLenh);
  const lichByLenh = groupBy(lichAll, (l) => l.MaLenh);
  const out: LenhCanXepLai[] = [];
  for (const lenh of lenhs) {
    const lyDo = lyDoCanXepLai(
      lenh,
      psByLenh.get(lenh.MaLenh) ?? [],
      lichByLenh.get(lenh.MaLenh) ?? [],
      mayMap,
    );
    if (lyDo) out.push({ lenh, lyDo });
  }
  return out;
}

// ---------------------------------------------------------------------------
// B. Tính lại lịch — GIỮ công đoạn đã Xong
// ---------------------------------------------------------------------------

export interface TinhLaiParams {
  /** Toàn bộ công đoạn của lệnh theo thứ tự (từ CongDoanCanLam). */
  congDoanCanLam: CongDoan[];
  soLuong: number;
  /** Các LichChay hiện có CỦA LỆNH (để biết công đoạn nào đã Xong). */
  lichCuaLenh: LichChay[];
  may: May[];
  /** Lịch của các lệnh KHÁC (để không đè máy). */
  lichHienCoKhac: LichChay[];
  ganMay?: Partial<Record<CongDoan, string>>;
  mocBatDauMongMuon?: string;
  /** % bù hao của lệnh; bỏ trống → dùng mặc định config. */
  buHaoPhanTram?: number;
  now: Date;
}

export interface KetQuaXepLai {
  /** Công đoạn đã Xong — giữ nguyên, KHÔNG tính lại. */
  congDoanGiuNguyen: LichChay[];
  /** Lịch mới cho các công đoạn còn lại. */
  lichMoi: LichChayTinh[];
  /** Mốc bắt đầu tối thiểu = cuối cùng của các công đoạn đã Xong. */
  cursor: string | null;
  /** Dự báo kết thúc cuối cùng của lệnh sau khi xếp lại. */
  ketThucDuBao: string;
}

/**
 * Tính lại lịch cho các công đoạn CHƯA Xong (chỉ chọn máy đang HoatDong),
 * bắt đầu sau mốc kết thúc của các công đoạn đã Xong. Công đoạn đã Xong giữ nguyên.
 */
export function tinhLaiLichConLai(p: TinhLaiParams): KetQuaXepLai {
  const daXong = p.lichCuaLenh.filter((l) => l.TrangThai === "Xong");
  const congDoanXong = new Set(daXong.map((l) => l.CongDoan));
  const cursor = daXong.reduce(
    (m, l) => (l.KetThucDuKien > m ? l.KetThucDuKien : m),
    "",
  );
  const congDoanConLai = p.congDoanCanLam.filter((cd) => !congDoanXong.has(cd));

  // Chỉ xếp lại lên máy HoatDong (loại BaoTri/Hong) — kể cả khi planner gán tay
  // vào một máy đã hỏng thì cũng không tìm thấy → tự lùi về máy nhanh nhất còn chạy.
  const mayHoatDong = p.may.filter((m) => m.TrangThai === "HoatDong");
  const mongMuon = p.mocBatDauMongMuon ?? "";
  const floorMoc = mongMuon > cursor ? mongMuon : cursor;

  const lichMoi =
    congDoanConLai.length > 0
      ? tinhLichChoLenh({
          congDoanCanLam: congDoanConLai,
          soLuong: p.soLuong,
          may: mayHoatDong,
          lichHienCo: p.lichHienCoKhac,
          ganMay: p.ganMay,
          mocBatDauMongMuon: floorMoc || undefined,
          buHaoPhanTram: p.buHaoPhanTram,
          now: p.now,
        })
      : [];

  const ketThucDuBao = lichMoi.reduce(
    (m, k) => (k.KetThucDuKien > m ? k.KetThucDuKien : m),
    cursor,
  );

  return {
    congDoanGiuNguyen: daXong,
    lichMoi,
    cursor: cursor || null,
    ketThucDuBao,
  };
}

// ---------------------------------------------------------------------------
// C. Đánh giá nguy cơ trễ sau sự cố
// ---------------------------------------------------------------------------

export interface NguyCoTreItem {
  MaLenh: string;
  MaLSXXuong: string;
  MaDon: string;
  TenSanPham: string;
  KhachHang: string;
  NgayGiaoHang: string;
  HanHoanThanh: string;
  ketThucDuBao: string;
  tre: boolean;
  lyDo: "vuotHan" | "hanSat" | null;
  maMayKet: string[];
}

/**
 * Mọi lệnh có công đoạn chưa Xong nằm trên máy không HoatDong (lọc theo maMayHong
 * nếu truyền). Dự báo ngày xong mới bằng tinhLaiLichConLai (thử nghiệm, không ghi);
 * đánh dấu trễ nếu dự báo vượt hạn HOẶC hạn nằm trong DE_DOA_TRE_NGAY ngày.
 */
export function danhSachNguyCoTre(params: {
  lenhs: LenhSanXuat[];
  lichAll: LichChay[];
  mayList: May[];
  donMap: Map<string, DonHang>;
  now: Date;
  homNay: string;
  maMayHong?: string;
}): NguyCoTreItem[] {
  const { lenhs, lichAll, mayList, donMap, now, homNay, maMayHong } = params;
  const mayMap = new Map(mayList.map((m) => [m.MaMay, m]));
  const lichByLenh = groupBy(lichAll, (l) => l.MaLenh);

  const out: NguyCoTreItem[] = [];
  for (const lenh of lenhs) {
    if (lenh.TrangThai === "HoanThanh") continue;
    const lichCuaLenh = lichByLenh.get(lenh.MaLenh) ?? [];
    const ket = lichCuaLenh.filter((l) => {
      if (l.TrangThai === "Xong" || !l.MaMay) return false;
      if (maMayHong && l.MaMay !== maMayHong) return false;
      const m = mayMap.get(l.MaMay);
      return m ? m.TrangThai !== "HoatDong" : false;
    });
    if (ket.length === 0) continue;

    const don = donMap.get(lenh.MaDon);
    const kq = tinhLaiLichConLai({
      congDoanCanLam: parseCongDoan(lenh.CongDoanCanLam),
      // Số lượng đưa vào công thức là SỐ TỜ IN của lệnh (không phải SL đơn/mã SP).
      soLuong: lenh.SoToIn ?? 0,
      lichCuaLenh,
      may: mayList,
      lichHienCoKhac: lichAll.filter((l) => l.MaLenh !== lenh.MaLenh),
      buHaoPhanTram: lenh.BuHaoPhanTram,
      now,
    });

    const vuotHan = treHan(kq.ketThucDuBao || null, lenh.HanHoanThanh);
    const conLai = lenh.HanHoanThanh
      ? soNgayGiua(homNay, lenh.HanHoanThanh)
      : Number.NaN;
    const hanSat = Number.isFinite(conLai) && conLai <= DE_DOA_TRE_NGAY;

    out.push({
      MaLenh: lenh.MaLenh,
      MaLSXXuong: lenh.MaLSXXuong ?? "",
      MaDon: lenh.MaDon,
      TenSanPham: don?.TenSanPham ?? "",
      KhachHang: don?.KhachHang ?? "",
      NgayGiaoHang: don?.NgayGiaoHang ?? "",
      HanHoanThanh: lenh.HanHoanThanh,
      ketThucDuBao: kq.ketThucDuBao,
      tre: vuotHan || hanSat,
      lyDo: vuotHan ? "vuotHan" : hanSat ? "hanSat" : null,
      maMayKet: [...new Set(ket.map((l) => l.MaMay))],
    });
  }

  return out.sort((a, b) =>
    (a.HanHoanThanh || "9999") < (b.HanHoanThanh || "9999") ? -1 : 1,
  );
}
