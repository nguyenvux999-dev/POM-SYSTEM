import { BaseRepository } from "./base";
import type { NguoiDung } from "@/lib/domain/types";
import { NGUOI_DUNG_COLUMNS } from "@/lib/domain/columns";

class NguoiDungRepository extends BaseRepository<NguoiDung> {
  /** Tìm người dùng theo email (không phân biệt hoa thường). */
  async findByEmail(email: string): Promise<NguoiDung | null> {
    const e = email.trim().toLowerCase();
    const all = await this.findAll();
    return all.find((u) => u.Email.trim().toLowerCase() === e) ?? null;
  }
}

export const nguoiDungRepository = new NguoiDungRepository({
  tab: "NguoiDung",
  columns: NGUOI_DUNG_COLUMNS,
  primaryKey: "Email",
});
