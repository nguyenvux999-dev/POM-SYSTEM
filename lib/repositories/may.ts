import { BaseRepository } from "./base";
import type { May } from "@/lib/domain/types";
import { MAY_COLUMNS } from "@/lib/domain/columns";

export const mayRepository = new BaseRepository<May>({
  tab: "May",
  columns: MAY_COLUMNS,
  primaryKey: "MaMay",
  numberColumns: ["NangSuat", "ThoiGianMakeReady"],
});

// Dữ liệu mẫu tab May nằm ở lib/domain/columns.ts (MAY_SEED_DATA) để script
// seed dùng được mà không phải import lớp repository (server-only).
