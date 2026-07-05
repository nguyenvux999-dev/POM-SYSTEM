/**
 * 1.10 — Gate SanSang (THUẦN).
 *
 * Một lệnh chỉ được đưa vào xếp lịch khi file đã "SanSang". Dùng để gắn nhãn
 * "Sẵn sàng xếp lịch" và để chặn xếp lịch khi lệnh chưa sẵn sàng.
 */

import type { LenhSanXuat } from "./types";

export function coTheXepLich(
  lenh: Pick<LenhSanXuat, "TrangThaiFile">,
): boolean {
  return lenh.TrangThaiFile === "SanSang";
}
