/**
 * Sinh mã tuần tự dạng `{prefix}-{year}-{NNNN}` (thuần, không side-effect).
 *
 * Quét các mã hiện có CÙNG prefix & năm, lấy số thứ tự lớn nhất + 1, zero-pad 4.
 * Đánh số theo năm (mỗi năm bắt đầu lại từ 0001). Mô hình một người dùng nên
 * không lo tranh chấp số.
 */
export function nextSequentialId(
  existing: readonly string[],
  prefix: string,
  year: number,
): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const id of existing) {
    const m = re.exec(String(id).trim());
    if (m && m[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}
