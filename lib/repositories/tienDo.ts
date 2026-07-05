import { BaseRepository } from "./base";
import type { TienDo } from "@/lib/domain/types";
import type { CongDoan } from "@/lib/domain/enums";
import { TIEN_DO_COLUMNS } from "@/lib/domain/columns";
import { nextShortId } from "@/lib/domain/id";
import { parseLocal } from "@/lib/domain/datetime";

/**
 * TienDo là APPEND-ONLY: chỉ cho phép thêm dòng (append) và đọc. KHÔNG expose
 * update/delete — mỗi cập nhật tiến độ là một dòng mới, giữ nguyên lịch sử.
 * "Trạng thái hiện tại = dòng mới nhất" được suy ở tầng app (moiNhat).
 */
class TienDoRepository extends BaseRepository<TienDo> {
  /** Thêm một dòng nhật ký tiến độ. */
  async append(log: TienDo): Promise<TienDo> {
    return this.appendRow(log);
  }

  /** Nhật ký của một lệnh (giữ nguyên thứ tự ghi). */
  async findByLenh(maLenh: string): Promise<TienDo[]> {
    const all = await this.findAll();
    return all.filter((t) => t.MaLenh === maLenh);
  }

  /**
   * Có ít nhất 1 dòng TienDo trỏ tới lệnh không (SỰ THẬT: lệnh đã bắt đầu chạy /
   * có tiến độ thật). Dùng cho quy tắc chặn sửa-ảnh-hưởng-lịch & chặn xóa.
   */
  async coTienDo(maLenh: string): Promise<boolean> {
    return (await this.findByLenh(maLenh)).length > 0;
  }

  /** Sinh MaLog dạng TD-NNN. */
  async generateMaLog(): Promise<string> {
    const all = await this.findAll();
    return nextShortId(
      all.map((t) => t.MaLog),
      "TD",
    );
  }

  /**
   * Dòng tiến độ MỚI NHẤT (theo ThoiGian) của một lệnh, tùy chọn lọc theo công
   * đoạn. Không có → null. Khi ThoiGian bằng nhau, ưu tiên dòng ghi sau (thứ tự sheet).
   */
  async moiNhat(maLenh: string, congDoan?: CongDoan): Promise<TienDo | null> {
    const ds = (await this.findByLenh(maLenh)).filter(
      (t) => !congDoan || t.CongDoan === congDoan,
    );
    if (ds.length === 0) return null;
    return ds.reduce((a, b) =>
      parseLocal(b.ThoiGian).getTime() >= parseLocal(a.ThoiGian).getTime()
        ? b
        : a,
    );
  }
}

const repo = new TienDoRepository({
  tab: "TienDo",
  columns: TIEN_DO_COLUMNS,
  primaryKey: "MaLog",
  numberColumns: ["SoLuongDat"],
});

/**
 * Chỉ export các lối an toàn (đóng gói để KHÔNG lộ insert/update/updateByKey/delete).
 */
export const tienDoRepository = {
  findAll: () => repo.findAll(),
  findByLenh: (maLenh: string) => repo.findByLenh(maLenh),
  coTienDo: (maLenh: string) => repo.coTienDo(maLenh),
  append: (log: TienDo) => repo.append(log),
  generateMaLog: () => repo.generateMaLog(),
  trangThaiHienTai: (maLenh: string, congDoan?: CongDoan) =>
    repo.moiNhat(maLenh, congDoan),
};
