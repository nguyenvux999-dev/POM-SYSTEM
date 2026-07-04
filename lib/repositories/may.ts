import { BaseRepository, RepositoryError } from "./base";
import type { May } from "@/lib/domain/types";
import type { MayLoai, MayTrangThai } from "@/lib/domain/enums";
import { MAY_COLUMNS } from "@/lib/domain/columns";
import { nowStamp } from "@/lib/domain/datetime";

/** Dữ liệu tạo/sửa máy (MaMay do người dùng đặt, vd "M07"). */
export interface MayInput {
  MaMay: string;
  TenMay: string;
  Loai: MayLoai;
  KhoToiDa: string;
  NangSuat: number;
  ThoiGianMakeReady: number;
  TrangThai: MayTrangThai;
}

class MayRepository extends BaseRepository<May> {
  /** Máy theo loại. */
  async findByLoai(loai: MayLoai): Promise<May[]> {
    const all = await this.findAll();
    return all.filter((m) => m.Loai === loai);
  }

  /** Máy HoatDong nhanh nhất (NangSuat lớn nhất) thuộc một loại; không có → null. */
  async nhanhNhatTheoLoai(loai: MayLoai): Promise<May | null> {
    const ds = (await this.findByLoai(loai)).filter(
      (m) => m.TrangThai === "HoatDong",
    );
    if (ds.length === 0) return null;
    return ds.reduce((best, m) => (m.NangSuat > best.NangSuat ? m : best));
  }

  /** Thêm máy mới (MaMay phải chưa tồn tại), tự set audit. */
  async create(input: MayInput, actorEmail: string): Promise<May> {
    const ma = input.MaMay.trim();
    if (!ma) throw new RepositoryError("Thiếu mã máy (MaMay).");
    if (await this.findById(ma)) {
      throw new RepositoryError(`Máy "${ma}" đã tồn tại.`);
    }
    const may: May = {
      MaMay: ma,
      TenMay: input.TenMay,
      Loai: input.Loai,
      KhoToiDa: input.KhoToiDa,
      NangSuat: input.NangSuat,
      ThoiGianMakeReady: input.ThoiGianMakeReady,
      TrangThai: input.TrangThai,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    return this.insert(may);
  }

  /** Cập nhật máy theo khóa, tự set audit. */
  async update(
    maMay: string,
    patch: Partial<May>,
    actorEmail: string,
  ): Promise<May> {
    return this.updateByKey(maMay, {
      ...patch,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    });
  }

  /**
   * Xóa máy — CHẶN nếu máy đang được tham chiếu bởi bất kỳ LichChay nào
   * (toàn vẹn tham chiếu thủ công, mục 5.5). Dùng dynamic import để tránh vòng
   * lặp import tĩnh với lichChay (lichChay import may để validate MaMay).
   */
  async xoa(maMay: string): Promise<void> {
    const { lichChayRepository } = await import("./lichChay");
    const dangDung = await lichChayRepository.findByMay(maMay);
    if (dangDung.length > 0) {
      throw new RepositoryError(
        `Không thể xóa máy "${maMay}": đang có ${dangDung.length} lịch chạy tham chiếu. Hãy xếp lại/hủy các lịch đó trước.`,
      );
    }
    await this.deleteByKey(maMay);
  }
}

export const mayRepository = new MayRepository({
  tab: "May",
  columns: MAY_COLUMNS,
  primaryKey: "MaMay",
  numberColumns: ["NangSuat", "ThoiGianMakeReady"],
});

// Dữ liệu mẫu tab May nằm ở lib/domain/columns.ts (MAY_SEED_DATA) để script
// seed dùng được mà không phải import lớp repository (server-only).
