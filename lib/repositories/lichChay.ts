import { BaseRepository } from "./base";
import type { LichChay } from "@/lib/domain/types";
import { LICH_CHAY_COLUMNS } from "@/lib/domain/columns";

export const lichChayRepository = new BaseRepository<LichChay>({
  tab: "LichChay",
  columns: LICH_CHAY_COLUMNS,
  primaryKey: "MaLich",
  numberColumns: ["ThuTu"],
});
