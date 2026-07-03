/**
 * Cache toàn sheet ở server (RAM).
 *
 * Chiến lược: đọc CẢ một tab một lần bằng spreadsheets.values.get, giữ trong
 * bộ nhớ với TTL ngắn (mặc định 30s). Việc lọc/join làm trong code (repository).
 * Với mô hình một người dùng, cách này gần như không đụng quota.
 *
 * Sau mỗi thao tác GHI phải gọi invalidate(tab) để lần đọc kế tiếp lấy dữ liệu mới.
 *
 * ⚠️ Lưu ý về vòng đời cache: trên Vercel (serverless) mỗi instance giữ cache
 * riêng và có thể bị thu hồi bất cứ lúc nào — đây là cache "best-effort" để
 * giảm số lần gọi API trong cùng một tiến trình, KHÔNG phải nguồn chân lý.
 */

import "server-only";
import {
  getSheetsClient,
  getSpreadsheetId,
  translateSheetsError,
} from "./client";
import { getCacheTtlSeconds } from "@/lib/env";

/** Một dòng dữ liệu thô từ Sheets (mảng ô dạng chuỗi). */
export type SheetRow = string[];

interface CacheEntry {
  rows: SheetRow[];
  expiresAt: number; // epoch ms
}

const store = new Map<string, CacheEntry>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Đọc thô toàn bộ một tab từ Google Sheets (có retry nhẹ cho lỗi 429). */
async function fetchTab(tab: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tab, // cả tab
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      });
      const values = (res.data.values ?? []) as unknown[][];
      // Chuẩn hóa mọi ô về string (Pha 0 làm việc ở mức chuỗi).
      return values.map((row) => row.map((cell) => String(cell ?? "")));
    } catch (err) {
      const translated = translateSheetsError(err);
      // Chỉ retry với lỗi quota (429), lần cuối thì ném ra.
      if (translated.status === 429 && attempt < maxAttempts) {
        await sleep(500 * attempt);
        continue;
      }
      throw translated;
    }
  }
  // Không bao giờ tới đây, nhưng để TypeScript hài lòng.
  return [];
}

/**
 * Lấy toàn bộ dòng của một tab (dùng cache nếu còn hạn).
 * Đọc cùng một tab hai lần liên tiếp chỉ gọi API một lần.
 */
export async function getRows(tab: string): Promise<SheetRow[]> {
  const now = Date.now();
  const cached = store.get(tab);
  if (cached && cached.expiresAt > now) {
    return cached.rows;
  }

  const rows = await fetchTab(tab);
  store.set(tab, {
    rows,
    expiresAt: now + getCacheTtlSeconds() * 1000,
  });
  return rows;
}

/** Xóa cache của một tab (gọi sau mỗi lần ghi vào tab đó). */
export function invalidate(tab: string): void {
  store.delete(tab);
}

/** Xóa toàn bộ cache. */
export function invalidateAll(): void {
  store.clear();
}
