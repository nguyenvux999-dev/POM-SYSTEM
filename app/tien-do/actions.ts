"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { RepositoryError } from "@/lib/repositories/base";
import { nowStamp } from "@/lib/domain/datetime";
import type { CongDoan } from "@/lib/domain/enums";

type Ket = { ok: true } | { ok: false; error: string };
const loi = (m: string): Ket => ({ ok: false, error: m });

async function actorEmail(): Promise<string> {
  const s = await auth();
  return s?.user?.email ?? "unknown";
}

/**
 * 2.12 — Cập nhật tiến độ một công đoạn của lệnh:
 *  - APPEND một dòng TienDo (giữ lịch sử).
 *  - Cascade trạng thái: công đoạn bắt đầu → LichChay=DangChay, Lệnh=DangChay,
 *    Đơn=DangSanXuat; công đoạn xong → LichChay=Xong; mọi công đoạn xong →
 *    Lệnh=HoanThanh (và Đơn=HoanThanh khi mọi lệnh của đơn đã xong).
 */
export async function capNhatTienDo(
  maLenh: string,
  congDoan: CongDoan,
  trangThaiMoi: "DangChay" | "Xong",
  soLuongDat: number,
  ghiChu?: string,
): Promise<Ket> {
  try {
    if (trangThaiMoi !== "DangChay" && trangThaiMoi !== "Xong") {
      return loi("Trạng thái mới không hợp lệ.");
    }
    if (!Number.isFinite(soLuongDat) || soLuongDat < 0) {
      return loi("Số lượng đạt phải là số ≥ 0.");
    }

    const email = await actorEmail();
    const lenh = await lenhSanXuatRepository.findById(maLenh);
    if (!lenh) return loi(`Không tồn tại lệnh "${maLenh}".`);

    // 1) Append TienDo.
    await tienDoRepository.append({
      MaLog: await tienDoRepository.generateMaLog(),
      MaLenh: maLenh,
      CongDoan: congDoan,
      ThoiGian: nowStamp(),
      TrangThaiMoi: trangThaiMoi,
      SoLuongDat: soLuongDat,
      NguoiCapNhat: email,
      GhiChu: ghiChu ?? "",
    });

    // 2) Cascade LichChay của công đoạn này.
    const rows = await lichChayRepository.findByLenh(maLenh);
    const target =
      rows.find((l) => l.CongDoan === congDoan && l.TrangThai !== "Xong") ??
      rows.find((l) => l.CongDoan === congDoan);
    if (target) {
      await lichChayRepository.update(
        target.MaLich,
        { TrangThai: trangThaiMoi === "Xong" ? "Xong" : "DangChay" },
        email,
      );
    }

    // 3) Lệnh bắt đầu chạy → DangChay; đơn → DangSanXuat.
    if (lenh.TrangThai === "DaLenLich") {
      await lenhSanXuatRepository.update(maLenh, { TrangThai: "DangChay" }, email);
    }
    const don = await donHangRepository.findById(lenh.MaDon);
    if (
      don &&
      (don.TrangThai === "Moi" ||
        don.TrangThai === "ChoCheBan" ||
        don.TrangThai === "DaLenLich")
    ) {
      await donHangRepository.update(lenh.MaDon, { TrangThai: "DangSanXuat" }, email);
    }

    // 4) Mọi công đoạn Xong → lệnh HoanThanh; mọi lệnh của đơn Xong → đơn HoanThanh.
    if (trangThaiMoi === "Xong") {
      const rows2 = await lichChayRepository.findByLenh(maLenh);
      const tatCaXong =
        rows2.length > 0 && rows2.every((l) => l.TrangThai === "Xong");
      if (tatCaXong) {
        await lenhSanXuatRepository.update(
          maLenh,
          { TrangThai: "HoanThanh" },
          email,
        );
        const lenhs = await lenhSanXuatRepository.findByMaDon(lenh.MaDon);
        if (lenhs.length > 0 && lenhs.every((l) => l.TrangThai === "HoanThanh")) {
          await donHangRepository.update(
            lenh.MaDon,
            { TrangThai: "HoanThanh" },
            email,
          );
        }
      }
    }

    revalidatePath("/tien-do");
    revalidatePath(`/tien-do/${maLenh}`);
    revalidatePath("/xep-lich");
    revalidatePath("/don-hang");
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}
