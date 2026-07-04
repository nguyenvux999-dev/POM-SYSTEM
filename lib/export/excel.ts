/**
 * Xuất báo cáo ra Excel bằng SheetJS.
 *
 * `xlsx` được import ĐỘNG (chỉ tải khi người dùng bấm xuất) để không phình bundle
 * trang. Ở đây CHỈ GHI (json_to_sheet + writeFile) từ dữ liệu đã có trên client —
 * không parse file ngoài, nên các advisory của xlsx (liên quan việc đọc file độc
 * hại) không áp dụng.
 */

export interface ExcelSheet {
  name: string;
  rows: Record<string, string | number>[];
}

/** Tạo & tải file .xlsx gồm một hoặc nhiều sheet. Chạy phía client. */
export async function xuatExcel(
  fileName: string,
  sheets: ExcelSheet[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    // Tên sheet Excel ≤ 31 ký tự, không rỗng.
    const safe = (s.name || "Sheet").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }
  XLSX.writeFile(wb, fileName);
}
