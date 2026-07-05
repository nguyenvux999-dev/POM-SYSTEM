/**
 * Cache đọc Google Sheets — PHẠM VI MỘT REQUEST.
 *
 * Bài học đã rút ra (nguồn của lỗi "ghi xong nhưng UI vẫn số cũ"): cache RAM sống
 * XUYÊN request/instance là con dao hai lưỡi. Trên Vercel (serverless) mỗi instance
 * giữ cache riêng — ghi ở instance A xóa cache A, nhưng lần đọc kế (router.refresh)
 * có thể trúng instance B còn cache cũ trong suốt TTL → trả số cũ.
 *
 * Vì vậy cache ở đây chỉ sống trong PHẠM VI MỘT request:
 *  - Trong cùng một request/render/Server Action: đọc cùng một tab nhiều lần chỉ
 *    gọi API một lần (dedup — tiết kiệm quota, giảm độ trễ khi cascade đọc lặp).
 *  - invalidate(tab) sau khi GHI: xóa entry để lần đọc SAU trong CÙNG request lấy
 *    dữ liệu mới (giữ đúng read-after-write trong luồng cascade trạng thái).
 *  - Hết request: toàn bộ cache biến mất → request/instance kế tiếp LUÔN đọc mới,
 *    không bao giờ có dữ liệu cũ giữa các lần tải trang hay giữa các instance.
 *
 * Cơ chế phạm vi: React `cache()` cấp một Map RIÊNG cho mỗi request server và một
 * Map MỚI cho request kế tiếp — không chia sẻ, tự dọn khi request kết thúc.
 */

import "server-only";
import { cache } from "react";
import {
  getSheetsClient,
  getSpreadsheetId,
  translateSheetsError,
} from "./client";

/** Một dòng dữ liệu thô từ Sheets (mảng ô dạng chuỗi). */
export type SheetRow = string[];

/**
 * Kho cache theo REQUEST. `cache()` bảo đảm mọi lần gọi trong cùng một request
 * trả về CÙNG một Map; request kế tiếp nhận Map mới tinh. Lưu Promise (không phải
 * mảng) để hai lần đọc song song cùng một tab chỉ gọi API một lần.
 */
const getRequestStore = cache((): Map<string, Promise<SheetRow[]>> => new Map());

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
      // Chuẩn hóa mọi ô về string.
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
 * Lấy toàn bộ dòng của một tab (dedup trong phạm vi request hiện tại).
 * Đọc cùng một tab hai lần trong CÙNG request chỉ gọi API một lần.
 */
export async function getRows(tab: string): Promise<SheetRow[]> {
  const store = getRequestStore();
  const cached = store.get(tab);
  if (cached) return cached;

  const promise = fetchTab(tab);
  store.set(tab, promise);
  try {
    return await promise;
  } catch (err) {
    // Đừng giữ lại promise lỗi — lần đọc sau trong cùng request được thử lại.
    store.delete(tab);
    throw err;
  }
}

/** Xóa cache của một tab (gọi sau mỗi lần ghi vào tab đó, trong cùng request). */
export function invalidate(tab: string): void {
  getRequestStore().delete(tab);
}

/** Xóa toàn bộ cache của request hiện tại. */
export function invalidateAll(): void {
  getRequestStore().clear();
}
