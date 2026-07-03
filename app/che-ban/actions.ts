"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { TRANG_THAI_FILE, type TrangThaiFile } from "@/lib/domain/enums";

/**
 * Đổi TrangThaiFile của một lệnh (Kanban chế bản).
 * UI dùng optimistic — action này là nguồn chân lý, lỗi -> client rollback.
 */
export async function capNhatTrangThaiFile(
  maLenh: string,
  trangThaiFile: TrangThaiFile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!TRANG_THAI_FILE.includes(trangThaiFile)) {
      return { ok: false, error: "Trạng thái file không hợp lệ." };
    }
    const session = await auth();
    const email = session?.user?.email ?? "unknown";
    await lenhSanXuatRepository.update(maLenh, { TrangThaiFile: trangThaiFile }, email);
    revalidatePath("/che-ban");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
