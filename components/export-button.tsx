"use client";

import { useState } from "react";
import { xuatExcel, type ExcelSheet } from "@/lib/export/excel";

/**
 * Nút "Xuất Excel" (SheetJS, tải động) + "In / PDF" (window.print + print CSS).
 * `sheets` là dữ liệu báo cáo đã được san phẳng ở server component.
 */
export function ExportButtons({
  fileName,
  sheets,
}: {
  fileName: string;
  sheets: ExcelSheet[];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function excel() {
    setErr(null);
    setBusy(true);
    try {
      await xuatExcel(fileName, sheets);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        onClick={excel}
        disabled={busy}
        className="rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
      >
        {busy ? "Đang tạo…" : "📊 Xuất Excel"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        🖨️ In / PDF
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
