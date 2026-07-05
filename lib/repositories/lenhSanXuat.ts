import { BaseRepository, RepositoryError } from "./base";
import type { LenhSanXuat } from "@/lib/domain/types";
import type { DoUuTien } from "@/lib/domain/enums";
import { LENH_SAN_XUAT_COLUMNS } from "@/lib/domain/columns";
import { nextSequentialId } from "@/lib/domain/id";
import { currentYearVN, nowStamp } from "@/lib/domain/datetime";
import { donHangRepository } from "./donHang";

/** Dữ liệu tạo lệnh ở tầng repo (CongDoanCanLam đã nối thành chuỗi ";"). */
export interface LenhCreateInput {
  MaDon: string;
  MoTaCongViec: string;
  CongDoanCanLam: string;
  DoUuTien: DoUuTien;
  HanHoanThanh: string;
  // Trường sản xuất bổ sung — đều tùy chọn.
  MaLSXXuong?: string;
  SoTrang?: number;
  KhoGiay?: string;
  KhoIn?: string;
  BuHaoPhanTram?: number;
}

class LenhSanXuatRepository extends BaseRepository<LenhSanXuat> {
  /** Tất cả lệnh thuộc một đơn. */
  async findByMaDon(maDon: string): Promise<LenhSanXuat[]> {
    const all = await this.findAll();
    return all.filter((l) => l.MaDon === maDon);
  }

  /** Sinh MaLenh dạng LSX-{năm}-{NNNN}. */
  async generateMaLenh(): Promise<string> {
    const all = await this.findAll();
    return nextSequentialId(
      all.map((l) => l.MaLenh),
      "LSX",
      currentYearVN(),
    );
  }

  /**
   * Tạo lệnh mới. Toàn vẹn tham chiếu (1.11): MaDon phải tồn tại trong DonHang,
   * nếu không -> RepositoryError, KHÔNG ghi.
   * Tạo với TrangThaiFile=ChoFile, TrangThai=ChoLenLich.
   */
  async create(
    input: LenhCreateInput,
    actorEmail: string,
  ): Promise<LenhSanXuat> {
    const don = await donHangRepository.findById(input.MaDon);
    if (!don) {
      throw new RepositoryError(
        `Không tồn tại đơn hàng MaDon="${input.MaDon}" — không thể tạo lệnh sản xuất.`,
      );
    }
    const lenh: LenhSanXuat = {
      MaLenh: await this.generateMaLenh(),
      MaDon: input.MaDon,
      MoTaCongViec: input.MoTaCongViec,
      CongDoanCanLam: input.CongDoanCanLam,
      TrangThaiFile: "ChoFile",
      DoUuTien: input.DoUuTien,
      HanHoanThanh: input.HanHoanThanh,
      TrangThai: "ChoLenLich",
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
      // Trường sản xuất bổ sung (bỏ trống → ghi ô rỗng, đọc lại thành ""/0/mặc định).
      MaLSXXuong: input.MaLSXXuong,
      SoTrang: input.SoTrang,
      KhoGiay: input.KhoGiay,
      KhoIn: input.KhoIn,
      BuHaoPhanTram: input.BuHaoPhanTram,
    };
    return this.insert(lenh);
  }

  /** Cập nhật lệnh theo khóa, tự set audit. */
  async update(
    maLenh: string,
    patch: Partial<LenhSanXuat>,
    actorEmail: string,
  ): Promise<LenhSanXuat> {
    return this.updateByKey(maLenh, {
      ...patch,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    });
  }
}

export const lenhSanXuatRepository = new LenhSanXuatRepository({
  tab: "LenhSanXuat",
  columns: LENH_SAN_XUAT_COLUMNS,
  primaryKey: "MaLenh",
  numberColumns: ["SoTrang", "BuHaoPhanTram"],
});
