/**
 * Lõi xếp lịch (THUẦN — không import "server-only"; chạy được cả ở client để
 * xem trước khi gán trên Planning Board).
 *
 * Triết lý: HỖ TRỢ QUYẾT ĐỊNH, không tối ưu tự động. Hàm chỉ đề xuất mốc thời
 * gian hợp lý cho từng công đoạn của MỘT lệnh; planner được phép gán lại máy /
 * dời mốc bắt đầu rồi gọi lại để tính lại.
 *
 * Giả định (giới hạn đã biết):
 *  - Mỗi công đoạn chạy trên ĐÚNG 1 máy.
 *  - Các công đoạn của một lệnh phụ thuộc TUẦN TỰ theo thứ tự trong CongDoanCanLam
 *    (In → Cán → Bế → Dán…): công đoạn sau bắt đầu sau khi công đoạn trước xong.
 *  - Chưa xét chia mẻ song song (không tách một lệnh chạy song song trên 2 máy).
 */

import type { CongDoan } from "./enums";
import type { LichChay, May } from "./types";
import {
  CONGDOAN_KHAC_MAKEREADY_PHUT,
  CONGDOAN_KHAC_NANGSUAT,
  CONGDOAN_MAY,
} from "./config";
import { addWorkingMinutes, formatLocal, parseLocal } from "./datetime";
import { soLuongCanIn } from "./estimate";

/** Tách chuỗi "In;CanMang;Be" → ["In","CanMang","Be"] (lọc rỗng). */
export function parseCongDoan(raw: string): CongDoan[] {
  return String(raw)
    .split(";")
    .map((s) => s.trim())
    .filter((s): s is CongDoan => s.length > 0);
}

/** Máy HoatDong NHANH NHẤT (NangSuat lớn nhất) thuộc một Loai; không có → null. */
export function chonMayNhanhNhat(may: May[], loai: string): May | null {
  let best: May | null = null;
  for (const m of may) {
    if (m.Loai !== loai || m.TrangThai !== "HoatDong") continue;
    if (!best || m.NangSuat > best.NangSuat) best = m;
  }
  return best;
}

/** Năng lực dùng để tính thời lượng của một công đoạn. */
export interface NangLucCongDoan {
  /** "" nếu công đoạn không có máy chuyên (DongGhim/EpKim/Khac). */
  maMay: string;
  tenMay: string;
  nangSuat: number;
  makeReady: number;
}

/**
 * Chọn năng lực cho một công đoạn:
 *  1. Nếu planner đã gán máy (ganMay) và máy đó tồn tại → dùng máy đó.
 *  2. Nếu công đoạn có loại máy chuyên (CONGDOAN_MAY) → máy nhanh nhất loại đó.
 *  3. Ngược lại → dùng CONGDOAN_KHAC_* (không gắn máy).
 */
export function nangLucChoCongDoan(
  congDoan: CongDoan,
  may: May[],
  ganMay?: Partial<Record<CongDoan, string>>,
): NangLucCongDoan {
  const chon = ganMay?.[congDoan];
  if (chon) {
    const m = may.find((x) => x.MaMay === chon);
    if (m) {
      return {
        maMay: m.MaMay,
        tenMay: m.TenMay,
        nangSuat: m.NangSuat,
        makeReady: m.ThoiGianMakeReady,
      };
    }
  }
  const loai = CONGDOAN_MAY[congDoan];
  if (loai) {
    const m = chonMayNhanhNhat(may, loai);
    if (m) {
      return {
        maMay: m.MaMay,
        tenMay: m.TenMay,
        nangSuat: m.NangSuat,
        makeReady: m.ThoiGianMakeReady,
      };
    }
  }
  return {
    maMay: "",
    tenMay: "(không máy chuyên)",
    nangSuat: CONGDOAN_KHAC_NANGSUAT,
    makeReady: CONGDOAN_KHAC_MAKEREADY_PHUT,
  };
}

/** Thời lượng (phút) một công đoạn: makeReady + (SoLuong / NangSuat) × 60. */
export function thoiLuongPhut(soLuong: number, nl: NangLucCongDoan): number {
  const sl = Number.isFinite(soLuong) && soLuong > 0 ? soLuong : 0;
  if (nl.nangSuat <= 0) return nl.makeReady;
  return nl.makeReady + (sl / nl.nangSuat) * 60;
}

/** Mốc rảnh kế tiếp của một máy = KetThucDuKien muộn nhất của lịch hiện có trên máy đó. */
function mocRanhMay(maMay: string, lich: LichChay[]): Date | null {
  if (!maMay) return null;
  let best: Date | null = null;
  for (const l of lich) {
    if (l.MaMay !== maMay) continue;
    const t = parseLocal(l.KetThucDuKien);
    if (Number.isNaN(t.getTime())) continue;
    if (!best || t.getTime() > best.getTime()) best = t;
  }
  return best;
}

/** Một dòng LichChay được tính (chưa có MaLich — repo sinh khi ghi). */
export interface LichChayTinh {
  CongDoan: CongDoan;
  MaMay: string;
  tenMay: string;
  BatDauDuKien: string;
  KetThucDuKien: string;
  ThuTu: number;
  thoiLuongPhut: number;
}

export interface TinhLichParams {
  congDoanCanLam: CongDoan[];
  soLuong: number;
  may: May[];
  /** Lịch đã có trên các máy (để không đè job khác). Khi xếp LẠI: loại lịch của chính lệnh này. */
  lichHienCo: LichChay[];
  /** Gán máy thủ công cho từng công đoạn (planner ghi đè lựa chọn mặc định). */
  ganMay?: Partial<Record<CongDoan, string>>;
  /** Mốc sớm nhất planner muốn bắt đầu (tùy chọn). */
  mocBatDauMongMuon?: string;
  /** % bù hao của lệnh; bỏ trống → dùng mặc định config. Cộng vào SoLuong trước khi tính. */
  buHaoPhanTram?: number;
  /** "Bây giờ" (wall-clock) — server truyền xuống để client tính nhất quán. */
  now: Date;
}

/**
 * Tính LichChay cho TOÀN BỘ công đoạn của một lệnh theo thứ tự tuần tự.
 * Không đè lên job khác đang có trên cùng máy (dựa vào mốc rảnh máy).
 */
export function tinhLichChoLenh(p: TinhLichParams): LichChayTinh[] {
  const ket: LichChayTinh[] = [];
  const mongMuon = p.mocBatDauMongMuon ? parseLocal(p.mocBatDauMongMuon) : null;
  // Số lượng đã cộng bù hao — dùng cho MỌI công đoạn của lệnh.
  const soLuongIn = soLuongCanIn(p.soLuong, p.buHaoPhanTram);
  // Bản làm việc: gồm lịch hiện có + các block vừa tính, để 2 công đoạn cùng lệnh
  // rơi trên CÙNG một máy cũng không đè nhau.
  const lichTam: LichChay[] = [...p.lichHienCo];
  let cursorTruoc: Date | null = null;

  for (const cd of p.congDoanCanLam) {
    const nl = nangLucChoCongDoan(cd, p.may, p.ganMay);
    const phut = thoiLuongPhut(soLuongIn, nl);

    const moc: number[] = [p.now.getTime()];
    const ranh = mocRanhMay(nl.maMay, lichTam);
    if (ranh) moc.push(ranh.getTime());
    if (cursorTruoc) moc.push(cursorTruoc.getTime());
    if (mongMuon && !Number.isNaN(mongMuon.getTime())) moc.push(mongMuon.getTime());

    const batDau = addWorkingMinutes(new Date(Math.max(...moc)), 0); // kẹp vào ca làm
    const ketThuc = addWorkingMinutes(batDau, phut);

    const item: LichChayTinh = {
      CongDoan: cd,
      MaMay: nl.maMay,
      tenMay: nl.tenMay,
      BatDauDuKien: formatLocal(batDau),
      KetThucDuKien: formatLocal(ketThuc),
      ThuTu: 0,
      thoiLuongPhut: Math.round(phut),
    };
    ket.push(item);
    cursorTruoc = ketThuc;

    if (nl.maMay) {
      lichTam.push({
        MaLich: `__tam_${ket.length}`,
        MaLenh: "",
        CongDoan: cd,
        MaMay: nl.maMay,
        ThuTu: 0,
        BatDauDuKien: item.BatDauDuKien,
        KetThucDuKien: item.KetThucDuKien,
        NguoiPhuTrach: "",
        TrangThai: "ChoChay",
        NguoiCapNhat: "",
        NgayCapNhat: "",
      });
    }
  }

  // ThuTu = thứ hạng theo BatDauDuKien trên từng máy, tính TOÀN CỤC (lịch hiện có
  // cùng máy + các block vừa tính). Chuỗi "YYYY-MM-DD HH:mm" so sánh chuỗi == thời gian.
  for (const it of ket) {
    if (!it.MaMay) {
      it.ThuTu = 1;
      continue;
    }
    const truoc = new Set<string>();
    for (const l of p.lichHienCo) {
      if (l.MaMay === it.MaMay && l.BatDauDuKien && l.BatDauDuKien < it.BatDauDuKien) {
        truoc.add(l.MaLich);
      }
    }
    let n = truoc.size;
    for (const k of ket) {
      if (k !== it && k.MaMay === it.MaMay && k.BatDauDuKien < it.BatDauDuKien) n++;
    }
    it.ThuTu = n + 1;
  }

  return ket;
}
