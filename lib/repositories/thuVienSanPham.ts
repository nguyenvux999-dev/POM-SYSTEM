import { BaseRepository, RepositoryError } from "./base";
import type { ThuVienSanPham } from "@/lib/domain/types";
import { THU_VIEN_SAN_PHAM_COLUMNS } from "@/lib/domain/columns";
import { nowStamp } from "@/lib/domain/datetime";
import { getRows, invalidate } from "@/lib/sheets/cache";
import {
  getSheetsClient,
  getSpreadsheetId,
  translateSheetsError,
} from "@/lib/sheets/client";

/** Nội dung một sản phẩm thư viện (audit do repo tự set khi ghi). */
export interface ThuVienSanPhamInput {
  MaSanPham: string;
  TenSanPham: string;
  KhachHang: string;
  AnhUrl: string;
  KhoThanhPham: string;
  LoaiGiay: string;
  GhiChu: string;
}

class ThuVienSanPhamRepository extends BaseRepository<ThuVienSanPham> {
  /** Tìm theo mã HOẶC tên (chứa, không phân biệt hoa thường); từ khóa trống → tất cả. */
  async timKiem(tuKhoa: string): Promise<ThuVienSanPham[]> {
    const all = await this.findAll();
    const q = tuKhoa.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (sp) =>
        sp.MaSanPham.toLowerCase().includes(q) ||
        sp.TenSanPham.toLowerCase().includes(q),
    );
  }

  /** Thêm sản phẩm mới. MaSanPham là khóa — trùng mã → RepositoryError, KHÔNG ghi. */
  async create(
    input: ThuVienSanPhamInput,
    actorEmail: string,
  ): Promise<ThuVienSanPham> {
    const ma = input.MaSanPham.trim();
    if (await this.findById(ma)) {
      throw new RepositoryError(
        `Mã sản phẩm "${ma}" đã có trong thư viện — dùng chức năng Sửa thay vì thêm mới.`,
      );
    }
    const row: ThuVienSanPham = {
      ...input,
      MaSanPham: ma,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    return this.insert(row);
  }

  /**
   * Sửa một sản phẩm, tự set audit. Cho phép ĐỔI CẢ MÃ (khóa chính) nên không
   * dùng updateByKey của lớp cha (cha cố ý ghim khóa) — tự ghi đè nguyên dòng
   * tại chỗ (một lệnh update, không delete+insert để tránh mất dòng giữa chừng).
   */
  async capNhat(
    ma: string,
    input: ThuVienSanPhamInput,
    actorEmail: string,
  ): Promise<ThuVienSanPham> {
    const maMoi = input.MaSanPham.trim();
    if (!maMoi) throw new RepositoryError("Mã sản phẩm không được để trống.");
    if (maMoi !== ma && (await this.findById(maMoi))) {
      throw new RepositoryError(
        `Mã sản phẩm "${maMoi}" đã có trong thư viện — không thể đổi trùng mã.`,
      );
    }

    const rows = await getRows(this.config.tab);
    const header = this.resolveHeader(rows);
    const pkIndex = header.indexOf(this.config.primaryKey);
    if (pkIndex < 0) {
      throw new RepositoryError(
        `Tab "${this.config.tab}" không có cột khóa chính "${this.config.primaryKey}".`,
      );
    }
    const dataRows = rows.slice(1);
    const dataIndex = dataRows.findIndex(
      (row) => String(row[pkIndex] ?? "") === ma,
    );
    if (dataIndex < 0) {
      throw new RepositoryError(
        `Không tìm thấy sản phẩm "${ma}" trong thư viện.`,
      );
    }

    const current = this.rowToObject(header, dataRows[dataIndex] ?? []);
    const merged: ThuVienSanPham = {
      ...current,
      ...input,
      MaSanPham: maMoi,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    const sheetRowNumber = dataIndex + 2; // +1 header, +1 vì Sheets đếm từ 1
    const sheets = getSheetsClient();
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${this.config.tab}!A${sheetRowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [this.objectToRow(header, merged)] },
      });
    } catch (err) {
      throw translateSheetsError(err);
    }

    invalidate(this.config.tab);
    return merged;
  }
}

export const thuVienSanPhamRepository = new ThuVienSanPhamRepository({
  tab: "ThuVienSanPham",
  columns: THU_VIEN_SAN_PHAM_COLUMNS,
  primaryKey: "MaSanPham",
});
