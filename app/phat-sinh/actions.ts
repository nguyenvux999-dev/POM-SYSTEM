"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { mayRepository } from "@/lib/repositories/may";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { RepositoryError } from "@/lib/repositories/base";
import { parseCongDoan } from "@/lib/domain/schedule";
import { tinhLaiLichConLai } from "@/lib/domain/reschedule";
import { nowLocal } from "@/lib/domain/datetime";
import { MAY_TRANG_THAI, PHAT_SINH_TRANG_THAI } from "@/lib/domain/enums";
import type {
  CongDoan,
  MayTrangThai,
  PhatSinhTrangThai,
} from "@/lib/domain/enums";
import type { PhatSinhInput } from "@/lib/domain/inputs";

type Ket = { ok: true } | { ok: false; error: string };
const loi = (m: string): Ket => ({ ok: false, error: m });

async function actorEmail(): Promise<string> {
  const s = await auth();
  return s?.user?.email ?? "unknown";
}

/**
 * 3.2 — Ghi một phát sinh. Nếu Loai=MayHong và có chọn máy + trạng thái mới cho
 * máy → cập nhật May.TrangThai (BaoTri/Hong). TrangThai phát sinh = Moi.
 */
export async function ghiPhatSinh(
  input: PhatSinhInput,
  maMay?: string,
  mayTrangThaiMoi?: MayTrangThai,
): Promise<Ket> {
  try {
    if (!input.MaLenh) return loi("Chưa chọn lệnh liên quan.");
    if (!input.MoTa?.trim()) return loi("Vui lòng nhập mô tả sự cố.");

    const email = await actorEmail();
    await phatSinhRepository.create(input, email);

    if (input.Loai === "MayHong" && maMay && mayTrangThaiMoi) {
      if (!MAY_TRANG_THAI.includes(mayTrangThaiMoi)) {
        return loi("Trạng thái máy không hợp lệ.");
      }
      await mayRepository.update(maMay, { TrangThai: mayTrangThaiMoi }, email);
    }

    revalidatePath("/phat-sinh");
    revalidatePath("/xep-lich");
    revalidatePath("/tien-do");
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** 3.6 — Đổi trạng thái xử lý của một phát sinh (Moi → DangXuLy → DaXong). */
export async function doiTrangThaiPhatSinh(
  maPhatSinh: string,
  trangThai: PhatSinhTrangThai,
): Promise<Ket> {
  try {
    if (!PHAT_SINH_TRANG_THAI.includes(trangThai)) {
      return loi("Trạng thái phát sinh không hợp lệ.");
    }
    const email = await actorEmail();
    await phatSinhRepository.update(maPhatSinh, { TrangThai: trangThai }, email);
    revalidatePath("/phat-sinh");
    return { ok: true };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** Cập nhật trạng thái một máy (hỏng/bảo trì/về hoạt động) — dùng để khôi phục sau sự cố. */
export async function capNhatTrangThaiMay(
  maMay: string,
  trangThai: MayTrangThai,
): Promise<Ket> {
  try {
    if (!MAY_TRANG_THAI.includes(trangThai)) {
      return loi("Trạng thái máy không hợp lệ.");
    }
    const email = await actorEmail();
    await mayRepository.update(maMay, { TrangThai: trangThai }, email);
    revalidatePath("/phat-sinh");
    revalidatePath("/xep-lich");
    return { ok: true };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/**
 * 3.4 — Xếp lại một lệnh sau sự cố: tính lại CÁC CÔNG ĐOẠN CHƯA XONG (chỉ máy
 * HoatDong), thay các LichChay chưa Xong cũ bằng lịch mới (xóa cũ → ghi mới),
 * GIỮ NGUYÊN công đoạn đã Xong.
 */
export async function xepLaiSuCo(
  maLenh: string,
  ganMay?: Record<string, string>,
  mocBatDau?: string,
): Promise<Ket> {
  try {
    const email = await actorEmail();
    const lenh = await lenhSanXuatRepository.findById(maLenh);
    if (!lenh) return loi(`Không tồn tại lệnh "${maLenh}".`);
    if (lenh.TrangThai === "HoanThanh") {
      return loi(`Lệnh "${maLenh}" đã hoàn thành, không cần xếp lại.`);
    }
    const don = await donHangRepository.findById(lenh.MaDon);
    if (!don) return loi(`Không tồn tại đơn "${lenh.MaDon}".`);

    const [mayList, lichAll] = await Promise.all([
      mayRepository.findAll(),
      lichChayRepository.findAll(),
    ]);
    const lichCuaLenh = lichAll.filter((l) => l.MaLenh === maLenh);
    if (lichCuaLenh.length === 0) {
      return loi(`Lệnh "${maLenh}" chưa có lịch để xếp lại.`);
    }

    const gan: Partial<Record<CongDoan, string>> = {};
    if (ganMay) {
      for (const [k, v] of Object.entries(ganMay)) {
        if (v) gan[k as CongDoan] = v;
      }
    }

    const kq = tinhLaiLichConLai({
      congDoanCanLam: parseCongDoan(lenh.CongDoanCanLam),
      soLuong: don.SoLuong,
      lichCuaLenh,
      may: mayList,
      lichHienCoKhac: lichAll.filter((l) => l.MaLenh !== maLenh),
      ganMay: gan,
      mocBatDauMongMuon: mocBatDau,
      buHaoPhanTram: lenh.BuHaoPhanTram,
      now: nowLocal(),
    });

    // Xóa các dòng chưa Xong (giữ dòng Xong), rồi tạo lịch mới.
    const canXoa = lichCuaLenh.filter((l) => l.TrangThai !== "Xong");
    const touched = new Set<string>();
    for (const r of canXoa) {
      if (r.MaMay) touched.add(r.MaMay);
      await lichChayRepository.deleteByKey(r.MaLich);
    }
    for (const it of kq.lichMoi) {
      await lichChayRepository.create(
        {
          MaLenh: maLenh,
          CongDoan: it.CongDoan,
          MaMay: it.MaMay,
          ThuTu: it.ThuTu,
          BatDauDuKien: it.BatDauDuKien,
          KetThucDuKien: it.KetThucDuKien,
          TrangThai: "ChoChay",
        },
        email,
      );
      if (it.MaMay) touched.add(it.MaMay);
    }
    for (const m of touched) await lichChayRepository.capNhatThuTuMay(m, email);

    revalidatePath("/phat-sinh");
    revalidatePath("/xep-lich");
    revalidatePath("/tien-do");
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}
