import { BaseRepository } from "./base";
import type { DonHang } from "@/lib/domain/types";
import type { DonHangTrangThai } from "@/lib/domain/enums";
import { DON_HANG_COLUMNS } from "@/lib/domain/columns";
import type { DonHangInput } from "@/lib/domain/inputs";
import { nextSequentialId } from "@/lib/domain/id";
import { currentYearVN, nowStamp } from "@/lib/domain/datetime";

class DonHangRepository extends BaseRepository<DonHang> {
  /** Lọc theo trạng thái + khách hàng (chứa, không phân biệt hoa thường); mới nhất trước. */
  async filter(
    opts: { trangThai?: DonHangTrangThai; khachHang?: string } = {},
  ): Promise<DonHang[]> {
    const all = await this.findAll();
    const kh = opts.khachHang?.trim().toLowerCase();
    return all
      .filter((d) => !opts.trangThai || d.TrangThai === opts.trangThai)
      .filter((d) => !kh || d.KhachHang.toLowerCase().includes(kh))
      .sort((a, b) => (a.MaDon < b.MaDon ? 1 : a.MaDon > b.MaDon ? -1 : 0));
  }

  /** Sinh MaDon dạng DH-{năm}-{NNNN}. */
  async generateMaDon(): Promise<string> {
    const all = await this.findAll();
    return nextSequentialId(
      all.map((d) => d.MaDon),
      "DH",
      currentYearVN(),
    );
  }

  /** Tạo đơn mới (TrangThai=Moi), tự set MaDon + audit. */
  async create(input: DonHangInput, actorEmail: string): Promise<DonHang> {
    const don: DonHang = {
      MaDon: await this.generateMaDon(),
      NgayNhan: input.NgayNhan,
      KhachHang: input.KhachHang,
      NVKinhDoanh: input.NVKinhDoanh,
      TenSanPham: input.TenSanPham,
      SoLuong: input.SoLuong,
      KhoThanhPham: input.KhoThanhPham,
      LoaiGiay: input.LoaiGiay,
      SoMau: input.SoMau,
      GiaCongSauIn: input.GiaCongSauIn,
      NgayGiaoHang: input.NgayGiaoHang,
      TrangThai: "Moi",
      GhiChu: input.GhiChu,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    return this.insert(don);
  }

  /** Cập nhật đơn theo khóa, tự set audit. */
  async update(
    maDon: string,
    patch: Partial<DonHang>,
    actorEmail: string,
  ): Promise<DonHang> {
    return this.updateByKey(maDon, {
      ...patch,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    });
  }
}

export const donHangRepository = new DonHangRepository({
  tab: "DonHang",
  columns: DON_HANG_COLUMNS,
  primaryKey: "MaDon",
  numberColumns: ["SoLuong"],
});
