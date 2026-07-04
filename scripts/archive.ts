/**
 * Script archive — chuyển đơn HoanThanh CŨ sang các tab Archive_YYYY_MM_<Entity>.
 *
 *   npm run archive            → DRY-RUN (chỉ liệt kê, KHÔNG ghi/xóa)
 *   npm run archive -- --apply → CHẠY THẬT
 *
 * ⚠️ TRƯỚC KHI CHẠY THẬT: bật lịch sử phiên bản Google Sheets + export sao lưu.
 *
 * Tiêu chí đơn đủ điều kiện:
 *  - DonHang.TrangThai = HoanThanh, và MỌI lệnh của đơn đều HoanThanh.
 *  - Ngày hoàn thành (suy từ TienDo) cũ hơn ARCHIVE_SAU_NGAY ngày.
 *
 * Cơ chế an toàn:
 *  - Ghi archive TRƯỚC (dedup theo khóa chính → idempotent), CHỈ xóa dòng ở tab
 *    chính SAU khi mọi lần ghi archive thành công.
 *  - Tự khởi tạo Sheets client (không import lib/sheets/* vì có "server-only");
 *    chỉ import module thuần (columns, report, datetime, config).
 */

import { config as loadEnv } from "dotenv";
import { google, type sheets_v4 } from "googleapis";
import { getGoogleEnv } from "../lib/env";
import {
  DON_HANG_COLUMNS,
  LENH_SAN_XUAT_COLUMNS,
  LICH_CHAY_COLUMNS,
  PHAT_SINH_COLUMNS,
  TIEN_DO_COLUMNS,
} from "../lib/domain/columns";
import { thoiDiemHoanThanhDon } from "../lib/domain/report";
import { soNgayGiua, todayVN } from "../lib/domain/datetime";
import { ARCHIVE_SAU_NGAY } from "../lib/domain/config";
import type { LenhSanXuat, TienDo } from "../lib/domain/types";

loadEnv({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

interface Entity {
  key: string;
  tab: string;
  columns: readonly string[];
  pk: string;
  fk: "MaDon" | "MaLenh" | null; // để lọc theo đơn/lệnh đủ điều kiện
}

const ENTITIES: Entity[] = [
  { key: "DonHang", tab: "DonHang", columns: DON_HANG_COLUMNS, pk: "MaDon", fk: "MaDon" },
  { key: "LenhSanXuat", tab: "LenhSanXuat", columns: LENH_SAN_XUAT_COLUMNS, pk: "MaLenh", fk: "MaDon" },
  { key: "LichChay", tab: "LichChay", columns: LICH_CHAY_COLUMNS, pk: "MaLich", fk: "MaLenh" },
  { key: "TienDo", tab: "TienDo", columns: TIEN_DO_COLUMNS, pk: "MaLog", fk: "MaLenh" },
  { key: "PhatSinh", tab: "PhatSinh", columns: PHAT_SINH_COLUMNS, pk: "MaPhatSinh", fk: "MaLenh" },
];

interface TabData {
  header: string[];
  objs: Record<string, string>[];
}

async function readTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string,
): Promise<TabData> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tab,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (res.data.values ?? []).map((r) =>
    r.map((c) => String(c ?? "")),
  );
  const header = values[0] ?? [];
  const objs = values.slice(1).map((row) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = row[i] ?? "";
    });
    return o;
  });
  return { header, objs };
}

async function main(): Promise<void> {
  const { clientEmail, privateKey, spreadsheetId } = getGoogleEnv();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`\n▶ Archive (${APPLY ? "APPLY — GHI THẬT" : "DRY-RUN"})  spreadsheet: ${spreadsheetId}\n`);

  // Đọc các tab chính.
  const data = new Map<string, TabData>();
  for (const e of ENTITIES) {
    data.set(e.key, await readTab(sheets, spreadsheetId, e.tab));
  }

  const donObjs = data.get("DonHang")!.objs;
  const lenhObjs = data.get("LenhSanXuat")!.objs;
  const tienDoObjs = data.get("TienDo")!.objs;

  // Nhóm phụ trợ để suy ngày hoàn thành.
  const lenhByDon = new Map<string, Record<string, string>[]>();
  for (const l of lenhObjs) {
    const arr = lenhByDon.get(l.MaDon ?? "") ?? [];
    arr.push(l);
    lenhByDon.set(l.MaDon ?? "", arr);
  }
  const tienDoByLenh = new Map<string, TienDo[]>();
  for (const t of tienDoObjs) {
    const arr = tienDoByLenh.get(t.MaLenh ?? "") ?? [];
    arr.push(t as unknown as TienDo);
    tienDoByLenh.set(t.MaLenh ?? "", arr);
  }

  const homNay = todayVN();

  // Xác định đơn đủ điều kiện.
  interface Eligible {
    MaDon: string;
    month: string; // YYYY_MM
    hoanThanh: string;
    lenhSet: Set<string>;
  }
  const eligible: Eligible[] = [];
  for (const d of donObjs) {
    if (d.TrangThai !== "HoanThanh") continue;
    const maDon = d.MaDon ?? "";
    const lenhs = lenhByDon.get(maDon) ?? [];
    if (lenhs.length === 0) continue;
    if (!lenhs.every((l) => l.TrangThai === "HoanThanh")) continue;

    const hoanThanh = thoiDiemHoanThanhDon(
      lenhs as unknown as LenhSanXuat[],
      tienDoByLenh,
    );
    if (!hoanThanh) {
      console.log(`  ⚠ ${maDon}: HoanThanh nhưng thiếu mốc TienDo → bỏ qua (an toàn).`);
      continue;
    }
    const tuoi = soNgayGiua(hoanThanh.slice(0, 10), homNay);
    if (!Number.isFinite(tuoi) || tuoi < ARCHIVE_SAU_NGAY) continue;

    eligible.push({
      MaDon: maDon,
      month: hoanThanh.slice(0, 7).replace("-", "_"),
      hoanThanh,
      lenhSet: new Set(lenhs.map((l) => l.MaLenh ?? "")),
    });
  }

  if (eligible.length === 0) {
    console.log(`  = Không có đơn đủ điều kiện archive (cũ hơn ${ARCHIVE_SAU_NGAY} ngày).\n`);
    return;
  }

  const monthByDon = new Map(eligible.map((e) => [e.MaDon, e.month]));
  const monthByLenh = new Map<string, string>();
  const eligibleLenh = new Set<string>();
  for (const e of eligible)
    for (const ml of e.lenhSet) {
      eligibleLenh.add(ml);
      monthByLenh.set(ml, e.month);
    }

  // Gom dòng cần archive theo (month, entity) + chỉ số dòng cần xóa ở tab chính.
  const groups = new Map<string, string[][]>(); // `${month}__${key}` -> rows (theo columns chuẩn)
  const delIndex = new Map<string, number[]>(); // entity.tab -> data indices

  function pushArchive(month: string, e: Entity, obj: Record<string, string>, dataIndex: number) {
    const gkey = `${month}__${e.key}`;
    const row = e.columns.map((c) => obj[c] ?? "");
    const g = groups.get(gkey) ?? [];
    g.push(row);
    groups.set(gkey, g);
    const di = delIndex.get(e.tab) ?? [];
    di.push(dataIndex);
    delIndex.set(e.tab, di);
  }

  for (const e of ENTITIES) {
    const td = data.get(e.key)!;
    td.objs.forEach((obj, i) => {
      const maDon = obj.MaDon ?? "";
      const maLenh = obj.MaLenh ?? "";
      let month: string | undefined;
      if (e.fk === "MaDon") {
        month = monthByDon.get(maDon);
      } else if (e.fk === "MaLenh") {
        if (eligibleLenh.has(maLenh)) month = monthByLenh.get(maLenh);
      }
      if (month) pushArchive(month, e, obj, i);
    });
  }

  // In tóm tắt.
  console.log(`  Đơn đủ điều kiện: ${eligible.length}`);
  for (const e of eligible) {
    console.log(`    • ${e.MaDon}  xong ${e.hoanThanh}  → Archive_${e.month}_*  (${e.lenhSet.size} lệnh)`);
  }
  console.log(`\n  Dòng sẽ chuyển theo tab:`);
  for (const [tab, idx] of delIndex) console.log(`    - ${tab}: ${idx.length} dòng`);

  if (!APPLY) {
    console.log(`\n  (DRY-RUN) Không ghi gì. Chạy lại với: npm run archive -- --apply\n`);
    return;
  }

  // === APPLY ===
  // Lấy metadata tab (title + sheetId) để tạo tab archive & xóa dòng.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const titleToId = new Map<string, number>();
  const titles = new Set<string>();
  for (const s of meta.data.sheets ?? []) {
    const p = s.properties;
    if (p?.title) {
      titles.add(p.title);
      if (typeof p.sheetId === "number") titleToId.set(p.title, p.sheetId);
    }
  }

  // 1) GHI archive (tạo tab nếu thiếu + header; dedup theo PK).
  for (const [gkey, rows] of groups) {
    const parts = gkey.split("__");
    const month = parts[0] ?? "";
    const entityKey = parts[1] ?? "";
    const entity = ENTITIES.find((e) => e.key === entityKey)!;
    const archiveTab = `Archive_${month}_${entityKey}`;

    if (!titles.has(archiveTab)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: archiveTab } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${archiveTab}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...entity.columns]] },
      });
      titles.add(archiveTab);
      console.log(`  + Tạo tab archive: ${archiveTab}`);
    }

    // Dedup: bỏ dòng đã có (theo PK) trong tab archive.
    const existing = await readTab(sheets, spreadsheetId, archiveTab);
    const pkIdx = entity.columns.indexOf(entity.pk);
    const existingPks = new Set(existing.objs.map((o) => o[entity.pk] ?? ""));
    const toAppend = rows.filter((r) => !existingPks.has(r[pkIdx] ?? ""));
    if (toAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: archiveTab,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: toAppend },
      });
    }
    console.log(`  ✓ ${archiveTab}: +${toAppend.length} dòng (bỏ ${rows.length - toAppend.length} trùng)`);
  }

  // 2) XÓA dòng ở tab chính (sau khi đã ghi archive xong). Xóa từ dưới lên.
  for (const [tab, indices] of delIndex) {
    const sheetId = titleToId.get(tab);
    if (sheetId === undefined) {
      console.log(`  ⚠ Không tìm thấy sheetId cho ${tab} → bỏ xóa (dữ liệu đã archive an toàn).`);
      continue;
    }
    const uniqDesc = [...new Set(indices)].sort((a, b) => b - a);
    const requests = uniqDesc.map((dataIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS" as const,
          startIndex: dataIndex + 1, // +1 vì có dòng header
          endIndex: dataIndex + 2,
        },
      },
    }));
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }
    console.log(`  ✓ ${tab}: xóa ${requests.length} dòng khỏi tab chính.`);
  }

  console.log(`\n✅ Archive xong.\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Archive thất bại: ${message}\n`);
  if (/permission|403/i.test(message)) {
    console.error("→ Hãy SHARE spreadsheet cho service account với quyền Editor.");
  }
  process.exit(1);
});
