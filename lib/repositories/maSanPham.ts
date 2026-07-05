import { BaseRepository, RepositoryError } from "./base";
import type { MaSanPham } from "@/lib/domain/types";
import { MA_SAN_PHAM_COLUMNS } from "@/lib/domain/columns";
import { nextShortId } from "@/lib/domain/id";
import { nowStamp } from "@/lib/domain/datetime";
import { lenhSanXuatRepository } from "./lenhSanXuat";

/** Dữ liệu tạo một dòng mã sản phẩm (MaDongSP do repo sinh). */
export interface MaSanPhamCreateInput {
  MaLenh: string;
  MaSanPham: string;
  TenSanPham: string;
  KichThuoc: string;
  SoLuong: number;
}

class MaSanPhamRepository extends BaseRepository<MaSanPham> {
  /** Các mã sản phẩm của một lệnh. */
  async findByLenh(maLenh: string): Promise<MaSanPham[]> {
    const all = await this.findAll();
    return all.filter((m) => m.MaLenh === maLenh);
  }

  /** Sinh MaDongSP dạng MSP-NNN. */
  async generateMaDongSP(): Promise<string> {
    const all = await this.findAll();
    return nextShortId(
      all.map((m) => m.MaDongSP),
      "MSP",
    );
  }

  /**
   * Tạo một dòng mã sản phẩm. Toàn vẹn tham chiếu: MaLenh phải tồn tại,
   * nếu không → RepositoryError, KHÔNG ghi.
   */
  async create(
    input: MaSanPhamCreateInput,
    actorEmail: string,
  ): Promise<MaSanPham> {
    const lenh = await lenhSanXuatRepository.findById(input.MaLenh);
    if (!lenh) {
      throw new RepositoryError(
        `Không tồn tại lệnh "${input.MaLenh}" — không thể thêm mã sản phẩm.`,
      );
    }
    const row: MaSanPham = {
      MaDongSP: await this.generateMaDongSP(),
      MaLenh: input.MaLenh,
      MaSanPham: input.MaSanPham,
      TenSanPham: input.TenSanPham,
      KichThuoc: input.KichThuoc,
      SoLuong: input.SoLuong,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    return this.insert(row);
  }

  /** Xóa TẤT CẢ mã sản phẩm của một lệnh (dọn kèm khi xóa lệnh). */
  async xoaTheoLenh(maLenh: string): Promise<number> {
    const ds = await this.findByLenh(maLenh);
    for (const m of ds) await this.deleteByKey(m.MaDongSP);
    return ds.length;
  }
}

export const maSanPhamRepository = new MaSanPhamRepository({
  tab: "MaSanPham",
  columns: MA_SAN_PHAM_COLUMNS,
  primaryKey: "MaDongSP",
  numberColumns: ["SoLuong"],
});
