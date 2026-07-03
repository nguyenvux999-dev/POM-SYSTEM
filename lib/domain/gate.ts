/**
 * 1.10 — Gate SanSang (THUẦN).
 *
 * Một lệnh chỉ được đưa vào xếp lịch (Giai đoạn 3, Pha 2) khi file đã "SanSang".
 * Pha 1 dùng hàm này để gắn nhãn "Sẵn sàng xếp lịch"; Pha 2 sẽ dùng lại để chặn.
 */

import type { LenhSanXuat } from "./types";

export function coTheXepLich(
  lenh: Pick<LenhSanXuat, "TrangThaiFile">,
): boolean {
  return lenh.TrangThaiFile === "SanSang";
}
