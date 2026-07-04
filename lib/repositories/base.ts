/**
 * BaseRepository — lớp truy cập dữ liệu trừu tượng dùng chung cho mọi tab.
 *
 * MỌI truy cập Google Sheets đi qua đây (qua cache). Route/component KHÔNG được
 * gọi thẳng Sheets API. Sau này muốn đổi sang Postgres chỉ cần viết lại lớp trong
 * của repository, phần còn lại của app không đổi.
 *
 * Nguyên tắc map row <-> object:
 *  - Đọc DÒNG TIÊU ĐỀ (row 1) từ chính sheet để biết vị trí cột. KHÔNG hardcode
 *    index cột -> thêm/đổi thứ tự cột không làm vỡ code.
 *  - `config.columns` chỉ là thứ tự CHUẨN dùng khi khởi tạo header (seed) và làm
 *    phương án dự phòng khi sheet rỗng.
 */

import "server-only";
import { getRows, invalidate, type SheetRow } from "@/lib/sheets/cache";
import {
  getSheetId,
  getSheetsClient,
  getSpreadsheetId,
  translateSheetsError,
} from "@/lib/sheets/client";

export interface RepositoryConfig {
  /** Tên tab trong spreadsheet. */
  tab: string;
  /** Thứ tự cột chuẩn (dùng cho seed header + dự phòng khi sheet rỗng). */
  columns: readonly string[];
  /** Tên cột khóa chính. */
  primaryKey: string;
  /** Các cột cần ép kiểu number khi đọc. */
  numberColumns?: readonly string[];
  /** Các cột cần ép kiểu boolean (TRUE/FALSE) khi đọc. */
  booleanColumns?: readonly string[];
}

/** Lỗi nghiệp vụ ở tầng repository (không tìm thấy khóa, trùng khóa...). */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class BaseRepository<T extends object> {
  constructor(protected readonly config: RepositoryConfig) {}

  protected get numberSet(): Set<string> {
    return new Set(this.config.numberColumns ?? []);
  }

  protected get booleanSet(): Set<string> {
    return new Set(this.config.booleanColumns ?? []);
  }

  /** Header thực tế của sheet; nếu sheet rỗng thì dùng thứ tự cột chuẩn. */
  protected resolveHeader(rows: SheetRow[]): string[] {
    const first = rows[0];
    if (first && first.length > 0) return first;
    return [...this.config.columns];
  }

  /** Ép một ô (chuỗi) về đúng kiểu theo tên cột. */
  protected coerceCell(column: string, raw: string): string | number | boolean {
    if (this.numberSet.has(column)) {
      const trimmed = raw.trim();
      if (trimmed === "") return 0;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : 0;
    }
    if (this.booleanSet.has(column)) {
      return raw.trim().toUpperCase() === "TRUE";
    }
    return raw;
  }

  /** Định dạng một giá trị object thành chuỗi để ghi vào ô. */
  protected formatCell(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return String(value);
  }

  /** Map một dòng thô -> object theo header. */
  protected rowToObject(header: string[], row: SheetRow): T {
    const obj: Record<string, string | number | boolean> = {};
    for (let i = 0; i < header.length; i++) {
      const column = header[i];
      if (!column) continue;
      const raw = row[i] ?? "";
      obj[column] = this.coerceCell(column, raw);
    }
    return obj as unknown as T;
  }

  /** Map một object -> dòng thô theo thứ tự header. */
  protected objectToRow(header: string[], obj: Partial<T>): string[] {
    const record = obj as unknown as Record<string, unknown>;
    return header.map((column) => this.formatCell(record[column]));
  }

  /** Đọc tất cả bản ghi. */
  async findAll(): Promise<T[]> {
    const rows = await getRows(this.config.tab);
    if (rows.length === 0) return [];
    const header = this.resolveHeader(rows);
    return rows.slice(1).map((row) => this.rowToObject(header, row));
  }

  /** Tìm bản ghi theo khóa chính; không thấy -> null. */
  async findById(id: string): Promise<T | null> {
    const all = await this.findAll();
    const pk = this.config.primaryKey;
    return (
      all.find(
        (item) =>
          String((item as Record<string, unknown>)[pk] ?? "") === String(id),
      ) ?? null
    );
  }

  /** Thêm một bản ghi mới (append vào cuối tab). */
  async insert(obj: T): Promise<T> {
    return this.appendRow(obj);
  }

  /**
   * Append một dòng (dùng cho cả insert thông thường và các tab append-only).
   * Tách riêng để TienDoRepository chỉ mở lối này.
   */
  protected async appendRow(obj: T): Promise<T> {
    const rows = await getRows(this.config.tab);
    const header = this.resolveHeader(rows);
    const values = [this.objectToRow(header, obj)];

    const sheets = getSheetsClient();
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: getSpreadsheetId(),
        range: this.config.tab,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    } catch (err) {
      throw translateSheetsError(err);
    }

    invalidate(this.config.tab);
    return obj;
  }

  /**
   * Cập nhật bản ghi theo khóa chính (đọc -> sửa -> ghi lại đúng dòng).
   * Không tìm thấy khóa -> RepositoryError.
   */
  async updateByKey(id: string, patch: Partial<T>): Promise<T> {
    const rows = await getRows(this.config.tab);
    const header = this.resolveHeader(rows);
    const pk = this.config.primaryKey;
    const pkIndex = header.indexOf(pk);
    if (pkIndex < 0) {
      throw new RepositoryError(
        `Tab "${this.config.tab}" không có cột khóa chính "${pk}".`,
      );
    }

    // rows[0] là header; dữ liệu bắt đầu từ rows[1] tương ứng dòng sheet số 2.
    const dataRows = rows.slice(1);
    const dataIndex = dataRows.findIndex(
      (row) => String(row[pkIndex] ?? "") === String(id),
    );
    if (dataIndex < 0) {
      throw new RepositoryError(
        `Không tìm thấy bản ghi có ${pk}="${id}" trong tab "${this.config.tab}".`,
      );
    }

    const current = this.rowToObject(header, dataRows[dataIndex] ?? []);
    const currentPk = (current as Record<string, unknown>)[pk];
    const merged: T = { ...current, ...patch, [pk]: currentPk } as T;
    const sheetRowNumber = dataIndex + 2; // +1 header, +1 vì Sheets đếm từ 1
    const values = [this.objectToRow(header, merged)];

    const sheets = getSheetsClient();
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${this.config.tab}!A${sheetRowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } catch (err) {
      throw translateSheetsError(err);
    }

    invalidate(this.config.tab);
    return merged;
  }

  /**
   * Xóa bản ghi theo khóa chính (batchUpdate deleteDimension đúng dòng).
   * Không tìm thấy khóa -> RepositoryError. Repo con quyết định có mở lối này ra
   * hay không (vd TienDo append-only KHÔNG expose delete).
   */
  async deleteByKey(id: string): Promise<void> {
    const rows = await getRows(this.config.tab);
    const header = this.resolveHeader(rows);
    const pk = this.config.primaryKey;
    const pkIndex = header.indexOf(pk);
    if (pkIndex < 0) {
      throw new RepositoryError(
        `Tab "${this.config.tab}" không có cột khóa chính "${pk}".`,
      );
    }
    const dataRows = rows.slice(1);
    const dataIndex = dataRows.findIndex(
      (row) => String(row[pkIndex] ?? "") === String(id),
    );
    if (dataIndex < 0) {
      throw new RepositoryError(
        `Không tìm thấy bản ghi có ${pk}="${id}" trong tab "${this.config.tab}".`,
      );
    }

    const sheetId = await getSheetId(this.config.tab);
    // rows[0] = header (API index 0); dòng dữ liệu đầu tiên có API index 1.
    const startIndex = dataIndex + 1;
    const sheets = getSheetsClient();
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex,
                  endIndex: startIndex + 1,
                },
              },
            },
          ],
        },
      });
    } catch (err) {
      throw translateSheetsError(err);
    }

    invalidate(this.config.tab);
  }
}
