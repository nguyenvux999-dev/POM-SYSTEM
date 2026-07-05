"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { RepositoryError } from "@/lib/repositories/base";
import type { DonHangInput, LenhDraftInput } from "@/lib/domain/inputs";

/** Email người đang đăng nhập (đã qua middleware — luôn có, phòng hờ fallback). */
async function actorEmail(): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? "unknown";
}

function loi(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function taoDon(
  input: DonHangInput,
): Promise<{ ok: true; maDon: string } | { ok: false; error: string }> {
  try {
    if (!input.TenSanPham?.trim()) return loi("Thiếu Tên sản phẩm.");
    if (!input.KhachHang?.trim()) return loi("Thiếu Khách hàng.");
    if (!input.NgayGiaoHang?.trim()) return loi("Thiếu Ngày giao hàng.");
    if (!Number.isFinite(input.SoLuong) || input.SoLuong <= 0) {
      return loi("Số lượng phải là số dương.");
    }

    const email = await actorEmail();
    const don = await donHangRepository.create(input, email);
    revalidatePath("/don-hang");
    return { ok: true, maDon: don.MaDon };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}

export async function taoNhieuLenh(
  maDon: string,
  drafts: LenhDraftInput[],
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  try {
    if (!drafts.length) return loi("Chưa có lệnh nào để tạo.");
    for (const d of drafts) {
      if (!d.CongDoanCanLam?.length) {
        return loi("Mỗi lệnh cần chọn ít nhất 1 công đoạn.");
      }
    }

    const email = await actorEmail();

    // Toàn vẹn tham chiếu: kiểm tra đơn tồn tại (repo cũng kiểm lại mỗi lần insert).
    const don = await donHangRepository.findById(maDon);
    if (!don) return loi(`Không tồn tại đơn hàng ${maDon}.`);

    let created = 0;
    for (const d of drafts) {
      await lenhSanXuatRepository.create(
        {
          MaDon: maDon,
          MoTaCongViec: d.MoTaCongViec ?? "",
          CongDoanCanLam: d.CongDoanCanLam.join(";"),
          DoUuTien: d.DoUuTien,
          HanHoanThanh: d.HanHoanThanh ?? "",
          MaLSXXuong: d.MaLSXXuong?.trim() || undefined,
          SoTrang: d.SoTrang,
          KhoGiay: d.KhoGiay?.trim() || undefined,
          KhoIn: d.KhoIn?.trim() || undefined,
          BuHaoPhanTram: d.BuHaoPhanTram,
        },
        email,
      );
      created++;
    }

    // Sau khi tạo lệnh, đơn chuyển sang "Chờ chế bản".
    await donHangRepository.update(maDon, { TrangThai: "ChoCheBan" }, email);

    revalidatePath(`/don-hang/${maDon}`);
    revalidatePath("/don-hang");
    revalidatePath("/che-ban");
    return { ok: true, created };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}
