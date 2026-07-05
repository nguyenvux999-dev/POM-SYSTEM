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
  SoToIn?: number;
}

class LenhSanXuatRepository extends BaseRepository<LenhSanXuat> {
  /** Tất cả lệnh thuộc một đơn (mô hình 1–1 → 0 hoặc 1 phần tử). */
  async findByMaDon(maDon: string): Promise<LenhSanXuat[]> {
    const all = await this.findAll();
    return all.filter((l) => l.MaDon === maDon);
  }

  /** Lệnh (DUY NHẤT) của một đơn — mô hình 1 đơn ↔ 1 lệnh; không có → null. */
  async findOneByMaDon(maDon: string): Promise<LenhSanXuat | null> {
    const all = await this.findAll();
    return all.find((l) => l.MaDon === maDon) ?? null;
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
    // Mô hình 1 đơn ↔ 1 lệnh: chặn tạo lệnh thứ hai cho cùng đơn.
    const daCo = await this.findOneByMaDon(input.MaDon);
    if (daCo) {
      throw new RepositoryError(
        `Đơn này đã có lệnh sản xuất (${daCo.MaLenh}) — mỗi đơn chỉ có 1 lệnh.`,
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
      SoToIn: input.SoToIn,
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
  numberColumns: ["SoTrang", "BuHaoPhanTram", "SoToIn"],
});
