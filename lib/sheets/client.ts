/**
 * Khởi tạo Google Sheets client (googleapis, chính thức) bằng Service Account.
 *
 * ⚠️ Server-side ONLY. Không bao giờ import file này vào code chạy ở client —
 * service-account key sẽ không được lộ ra trình duyệt.
 *
 * Client được tạo dạng singleton và tái sử dụng giữa các request.
 */

import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { getGoogleEnv } from "@/lib/env";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let cachedClient: sheets_v4.Sheets | null = null;
let cachedSpreadsheetId: string | null = null;

/** Trả về Sheets client dùng chung (khởi tạo lần đầu, sau đó tái dùng). */
export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const { clientEmail, privateKey } = getGoogleEnv();

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/** ID spreadsheet đang thao tác (đọc từ env, cache lại). */
export function getSpreadsheetId(): string {
  if (cachedSpreadsheetId) return cachedSpreadsheetId;
  cachedSpreadsheetId = getGoogleEnv().spreadsheetId;
  return cachedSpreadsheetId;
}

/** Lỗi khi thao tác với Google Sheets — đã dịch sang thông báo dễ hiểu. */
export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SheetsError";
  }
}

/**
 * Dịch lỗi thô từ googleapis thành SheetsError với thông báo rõ ràng.
 * - 403: thường do CHƯA share spreadsheet cho email service account.
 * - 404: sai SPREADSHEET_ID.
 * - 429: vượt quota (quá nhiều request/phút).
 */
export function translateSheetsError(err: unknown): SheetsError {
  const anyErr = err as {
    code?: number | string;
    status?: number;
    message?: string;
    errors?: Array<{ message?: string }>;
  };
  const status =
    typeof anyErr?.code === "number"
      ? anyErr.code
      : typeof anyErr?.status === "number"
        ? anyErr.status
        : undefined;
  const detail =
    anyErr?.errors?.[0]?.message ?? anyErr?.message ?? "Lỗi không xác định";

  switch (status) {
    case 401:
      return new SheetsError(
        `[Sheets 401] Xác thực Service Account thất bại. Kiểm tra GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY (nhớ giữ "\\n"). Chi tiết: ${detail}`,
        status,
        err,
      );
    case 403:
      return new SheetsError(
        `[Sheets 403] Không có quyền truy cập spreadsheet. Hãy SHARE spreadsheet cho email service account với quyền Editor. Chi tiết: ${detail}`,
        status,
        err,
      );
    case 404:
      return new SheetsError(
        `[Sheets 404] Không tìm thấy spreadsheet. Kiểm tra SPREADSHEET_ID. Chi tiết: ${detail}`,
        status,
        err,
      );
    case 429:
      return new SheetsError(
        `[Sheets 429] Vượt quá quota Google Sheets API (quá nhiều request). Hãy thử lại sau giây lát. Chi tiết: ${detail}`,
        status,
        err,
      );
    default:
      return new SheetsError(
        `[Sheets${status ? " " + status : ""}] ${detail}`,
        status,
        err,
      );
  }
}

/** Reset client (chỉ dùng cho test/seed khi cần khởi tạo lại). */
export function __resetSheetsClientForTesting(): void {
  cachedClient = null;
  cachedSpreadsheetId = null;
}
