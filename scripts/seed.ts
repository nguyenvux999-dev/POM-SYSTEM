/**
 * Script seed — chạy bằng: npm run seed
 *
 * Nhiệm vụ (idempotent — chạy lại nhiều lần không nhân đôi dữ liệu):
 *  1. Kiểm tra 7 tab; tab nào thiếu -> tạo mới.
 *  2. Đảm bảo dòng 1 mỗi tab đúng header (nếu tab rỗng -> ghi header).
 *  3. Nạp 6 dòng dữ liệu mẫu May, CHỈ khi tab May chưa có dữ liệu.
 *
 * ⚠️ Script này CỐ Ý tự khởi tạo Sheets client (không import lib/sheets/*),
 * vì các module đó có `import "server-only"` — sẽ ném lỗi khi chạy ngoài môi
 * trường React Server Component (tsx/Node). Ở đây chỉ import các module "thuần".
 */

import { config as loadEnv } from "dotenv";
import { google } from "googleapis";
import { getGoogleEnv } from "../lib/env";
import {
  MAY_COLUMNS,
  MAY_SEED_DATA,
  TAB_SCHEMAS,
} from "../lib/domain/columns";

// Nạp biến môi trường từ .env.local trước khi đọc env.
loadEnv({ path: ".env.local" });

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

async function main(): Promise<void> {
  const { clientEmail, privateKey, spreadsheetId } = getGoogleEnv();

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`\n▶ Seed spreadsheet: ${spreadsheetId}\n`);

  // 1. Lấy danh sách tab hiện có.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existingTitles = new Set(
    (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  );

  // 2. Tạo các tab còn thiếu (một batchUpdate).
  const missing = TAB_SCHEMAS.filter((t) => !existingTitles.has(t.tab));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((t) => ({
          addSheet: { properties: { title: t.tab } },
        })),
      },
    });
    for (const t of missing) console.log(`  + Tạo tab: ${t.tab}`);
  }

  // 3. Đảm bảo header đúng cho từng tab.
  for (const { tab, columns } of TAB_SCHEMAS) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!1:1`,
    });
    const firstRow = res.data.values?.[0] ?? [];
    const hasHeader = firstRow.some((c) => String(c ?? "").trim() !== "");
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...columns]] },
      });
      console.log(`  ✓ Ghi header cho tab: ${tab}`);
    } else {
      console.log(`  = Header đã có: ${tab}`);
    }
  }

  // 4. Nạp dữ liệu mẫu May (chỉ khi chưa có dữ liệu — idempotent).
  const mayData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "May!A2:A",
  });
  const mayHasData = (mayData.data.values ?? []).some(
    (row) => String(row[0] ?? "").trim() !== "",
  );
  if (mayHasData) {
    console.log(`\n  = Tab May đã có dữ liệu — bỏ qua seed mẫu.`);
  } else {
    const rows = MAY_SEED_DATA.map((m) => {
      const record = m as unknown as Record<string, unknown>;
      return MAY_COLUMNS.map((col) => formatCell(record[col]));
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "May",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    console.log(`\n  ✓ Nạp ${rows.length} dòng dữ liệu mẫu vào tab May.`);
  }

  console.log(`\n✅ Seed xong.\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Seed thất bại: ${message}\n`);
  // Gợi ý lỗi thường gặp.
  if (/permission|403/i.test(message)) {
    console.error(
      "→ Hãy SHARE spreadsheet cho email service account với quyền Editor.",
    );
  }
  if (/not found|404/i.test(message)) {
    console.error("→ Kiểm tra lại SPREADSHEET_ID trong .env.local.");
  }
  process.exit(1);
});
