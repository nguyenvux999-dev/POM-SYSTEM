import { BaseRepository } from "./base";
import type { TienDo } from "@/lib/domain/types";
import { TIEN_DO_COLUMNS } from "@/lib/domain/columns";

/**
 * TienDo là APPEND-ONLY: chỉ cho phép thêm dòng (append) và đọc (findAll).
 * KHÔNG expose update/delete — mỗi cập nhật tiến độ là một dòng mới, giữ nguyên
 * lịch sử. (Logic "trạng thái hiện tại = dòng mới nhất" để dành pha sau.)
 */
class TienDoRepository extends BaseRepository<TienDo> {
  /** Thêm một dòng nhật ký tiến độ. */
  async append(log: TienDo): Promise<TienDo> {
    return this.appendRow(log);
  }
}

const repo = new TienDoRepository({
  tab: "TienDo",
  columns: TIEN_DO_COLUMNS,
  primaryKey: "MaLog",
  numberColumns: ["SoLuongDat"],
});

/**
 * Chỉ export findAll + append (đóng gói để không lộ insert/update/updateByKey).
 */
export const tienDoRepository = {
  findAll: () => repo.findAll(),
  append: (log: TienDo) => repo.append(log),
};
