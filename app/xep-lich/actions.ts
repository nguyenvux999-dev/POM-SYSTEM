"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { mayRepository } from "@/lib/repositories/may";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { RepositoryError } from "@/lib/repositories/base";
import { coTheXepLich } from "@/lib/domain/gate";
import {
  parseCongDoan,
  tinhLichChoLenh,
  type LichChayTinh,
} from "@/lib/domain/schedule";
import { nowLocal } from "@/lib/domain/datetime";
import type { CongDoan } from "@/lib/domain/enums";
import type { LenhSanXuat } from "@/lib/domain/types";

type Ket = { ok: true } | { ok: false; error: string };
const loi = (m: string): Ket => ({ ok: false, error: m });

async function actorEmail(): Promise<string> {
  const s = await auth();
  return s?.user?.email ?? "unknown";
}

/** Chuẩn hóa map gán máy từ client (Record<string,string>) về CongDoan. */
function chuanGanMay(
  ganMay?: Record<string, string>,
): Partial<Record<CongDoan, string>> {
  const out: Partial<Record<CongDoan, string>> = {};
  if (!ganMay) return out;
  for (const [k, v] of Object.entries(ganMay)) {
    if (v) out[k as CongDoan] = v;
  }
  return out;
}

/** Tính lịch cho một lệnh (dùng chung cho xếp mới & xếp lại). */
async function tinh(
  maLenh: string,
  ganMay: Record<string, string> | undefined,
  mocBatDau: string | undefined,
  loaiTruChinhLenh: boolean,
): Promise<{ lenh: LenhSanXuat; ket: LichChayTinh[] }> {
  const lenh = await lenhSanXuatRepository.findById(maLenh);
  if (!lenh) throw new RepositoryError(`Không tồn tại lệnh "${maLenh}".`);
  if (!coTheXepLich(lenh)) {
    throw new RepositoryError(
      `Lệnh "${maLenh}" chưa Sẵn sàng (TrangThaiFile=${lenh.TrangThaiFile}) nên chưa xếp lịch được.`,
    );
  }
  const don = await donHangRepository.findById(lenh.MaDon);
  if (!don) throw new RepositoryError(`Không tồn tại đơn "${lenh.MaDon}".`);

  const [may, lichAll] = await Promise.all([
    mayRepository.findAll(),
    lichChayRepository.findAll(),
  ]);
  const lichHienCo = loaiTruChinhLenh
    ? lichAll.filter((l) => l.MaLenh !== maLenh)
    : lichAll;

  const ket = tinhLichChoLenh({
    congDoanCanLam: parseCongDoan(lenh.CongDoanCanLam),
    soLuong: don.SoLuong,
    may,
    lichHienCo,
    ganMay: chuanGanMay(ganMay),
    mocBatDauMongMuon: mocBatDau,
    buHaoPhanTram: lenh.BuHaoPhanTram,
    now: nowLocal(),
  });
  return { lenh, ket };
}

/** Nâng trạng thái đơn lên DaLenLich khi MỌI lệnh của đơn đã (ít nhất) lên lịch. */
async function capNhatTrangThaiDon(
  maDon: string,
  email: string,
): Promise<void> {
  const lenhs = await lenhSanXuatRepository.findByMaDon(maDon);
  if (lenhs.length === 0) return;
  const daLen = lenhs.every((l) =>
    ["DaLenLich", "DangChay", "HoanThanh"].includes(l.TrangThai),
  );
  if (!daLen) return;
  const don = await donHangRepository.findById(maDon);
  if (don && (don.TrangThai === "Moi" || don.TrangThai === "ChoCheBan")) {
    await donHangRepository.update(maDon, { TrangThai: "DaLenLich" }, email);
  }
}

/**
 * 2.5 + 2.9 — Xếp một lệnh CHỜ vào máy: tính lịch tuần tự các công đoạn (mặc định
 * máy nhanh nhất, hoặc theo `ganMay`), tạo LichChay, rồi chốt: đặt lệnh DaLenLich
 * và đơn DaLenLich (nếu mọi lệnh của đơn đã lên lịch).
 */
export async function xepLenh(
  maLenh: string,
  ganMay?: Record<string, string>,
  mocBatDau?: string,
): Promise<Ket> {
  try {
    const email = await actorEmail();
    const { lenh, ket } = await tinh(maLenh, ganMay, mocBatDau, false);
    if (lenh.TrangThai !== "ChoLenLich") {
      return loi(
        `Lệnh "${maLenh}" đang ở trạng thái ${lenh.TrangThai}; hãy dùng "xếp lại" thay vì xếp mới.`,
      );
    }
    if (ket.length === 0) return loi("Lệnh không có công đoạn để xếp.");

    const touched = new Set<string>();
    for (const it of ket) {
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
    await lenhSanXuatRepository.update(maLenh, { TrangThai: "DaLenLich" }, email);
    await capNhatTrangThaiDon(lenh.MaDon, email);
    for (const m of touched) await lichChayRepository.capNhatThuTuMay(m, email);

    revalidatePath("/xep-lich");
    revalidatePath("/tien-do");
    revalidatePath("/don-hang");
    return { ok: true };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/**
 * 2.5 — Xếp LẠI một lệnh đã có lịch: tính lại theo `ganMay`/`mocBatDau` mới rồi
 * CẬP NHẬT các dòng LichChay hiện có (không tạo dòng mới). Trạng thái giữ nguyên.
 */
export async function xepLaiLenh(
  maLenh: string,
  ganMay?: Record<string, string>,
  mocBatDau?: string,
): Promise<Ket> {
  try {
    const email = await actorEmail();
    const existing = await lichChayRepository.findByLenh(maLenh);
    if (existing.length === 0) {
      return loi(`Lệnh "${maLenh}" chưa có lịch để xếp lại.`);
    }
    const { ket } = await tinh(maLenh, ganMay, mocBatDau, true);

    const touched = new Set<string>();
    const used = new Set<string>();
    for (const it of ket) {
      const row = existing.find(
        (r) => r.CongDoan === it.CongDoan && !used.has(r.MaLich),
      );
      if (!row) continue;
      used.add(row.MaLich);
      if (row.MaMay) touched.add(row.MaMay);
      if (it.MaMay) touched.add(it.MaMay);
      await lichChayRepository.update(
        row.MaLich,
        {
          MaMay: it.MaMay,
          ThuTu: it.ThuTu,
          BatDauDuKien: it.BatDauDuKien,
          KetThucDuKien: it.KetThucDuKien,
        },
        email,
      );
    }
    for (const m of touched) await lichChayRepository.capNhatThuTuMay(m, email);

    revalidatePath("/xep-lich");
    revalidatePath("/tien-do");
    return { ok: true };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}
