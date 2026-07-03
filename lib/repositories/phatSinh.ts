import { BaseRepository } from "./base";
import type { PhatSinh } from "@/lib/domain/types";
import { PHAT_SINH_COLUMNS } from "@/lib/domain/columns";

export const phatSinhRepository = new BaseRepository<PhatSinh>({
  tab: "PhatSinh",
  columns: PHAT_SINH_COLUMNS,
  primaryKey: "MaPhatSinh",
  booleanColumns: ["AnhHuongTienDo"],
});
