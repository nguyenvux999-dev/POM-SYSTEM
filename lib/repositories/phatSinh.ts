import { BaseRepository, RepositoryError } from "./base";
import type { PhatSinh } from "@/lib/domain/types";
import { PHAT_SINH_COLUMNS } from "@/lib/domain/columns";
import type { PhatSinhInput } from "@/lib/domain/inputs";
import { nextShortId } from "@/lib/domain/id";
import { nowStamp } from "@/lib/domain/datetime";
import { lenhSanXuatRepository } from "./lenhSanXuat";

class PhatSinhRepository extends BaseRepository<PhatSinh> {
  /** Phát sinh của một lệnh. */
  async findByLenh(maLenh: string): Promise<PhatSinh[]> {
    const all = await this.findAll();
    return all.filter((p) => p.MaLenh === maLenh);
  }

  /**
   * Xóa TẤT CẢ phát sinh của một lệnh (dọn kèm khi xóa lệnh — gồm cả marker
   * "cần xếp lại" tự sinh — để không còn phát sinh mồ côi trỏ tới lệnh đã xóa).
   */
  async xoaTheoLenh(maLenh: string): Promise<number> {
    const ds = await this.findByLenh(maLenh);
    for (const p of ds) await this.deleteByKey(p.MaPhatSinh);
    return ds.length;
  }

  /** Phát sinh còn "mở" (Moi hoặc DangXuLy), mới nhất trước. */
  async findMoNhat(): Promise<PhatSinh[]> {
    const all = await this.findAll();
    return all
      .filter((p) => p.TrangThai === "Moi" || p.TrangThai === "DangXuLy")
      .sort((a, b) => (a.ThoiGian < b.ThoiGian ? 1 : a.ThoiGian > b.ThoiGian ? -1 : 0));
  }

  /** Sinh MaPhatSinh dạng PS-NNN. */
  async generateMaPhatSinh(): Promise<string> {
    const all = await this.findAll();
    return nextShortId(
      all.map((p) => p.MaPhatSinh),
      "PS",
    );
  }

  /**
   * Ghi một phát sinh mới. Toàn vẹn tham chiếu: MaLenh phải tồn tại, nếu không
   * → RepositoryError. Tạo với TrangThai=Moi, ThoiGian=bây giờ.
   */
  async create(input: PhatSinhInput, actorEmail: string): Promise<PhatSinh> {
    const lenh = await lenhSanXuatRepository.findById(input.MaLenh);
    if (!lenh) {
      throw new RepositoryError(
        `Không tồn tại lệnh "${input.MaLenh}" — không thể ghi phát sinh.`,
      );
    }
    const ps: PhatSinh = {
      MaPhatSinh: await this.generateMaPhatSinh(),
      MaLenh: input.MaLenh,
      Loai: input.Loai,
      MoTa: input.MoTa,
      MucDo: input.MucDo,
      AnhHuongTienDo: input.AnhHuongTienDo,
      HuongXuLy: input.HuongXuLy,
      TrangThai: "Moi",
      ThoiGian: nowStamp(),
      NguoiCapNhat: actorEmail,
    };
    return this.insert(ps);
  }

  /** Cập nhật phát sinh theo khóa, tự set NguoiCapNhat. */
  async update(
    maPhatSinh: string,
    patch: Partial<PhatSinh>,
    actorEmail: string,
  ): Promise<PhatSinh> {
    return this.updateByKey(maPhatSinh, {
      ...patch,
      NguoiCapNhat: actorEmail,
    });
  }
}

export const phatSinhRepository = new PhatSinhRepository({
  tab: "PhatSinh",
  columns: PHAT_SINH_COLUMNS,
  primaryKey: "MaPhatSinh",
  booleanColumns: ["AnhHuongTienDo"],
});
