import { BaseRepository, RepositoryError } from "./base";
import type { LichChay } from "@/lib/domain/types";
import type { CongDoan, LichTrangThai } from "@/lib/domain/enums";
import { LICH_CHAY_COLUMNS } from "@/lib/domain/columns";
import { nextShortId } from "@/lib/domain/id";
import { nowStamp, parseLocal } from "@/lib/domain/datetime";
import { coTheXepLich } from "@/lib/domain/gate";
import { lenhSanXuatRepository } from "./lenhSanXuat";
import { mayRepository } from "./may";

/** Dữ liệu tạo một dòng lịch (MaLich do repo sinh). */
export interface LichChayCreateInput {
  MaLenh: string;
  CongDoan: CongDoan;
  /** "" nếu công đoạn không có máy chuyên. */
  MaMay: string;
  ThuTu: number;
  BatDauDuKien: string;
  KetThucDuKien: string;
  NguoiPhuTrach?: string;
  TrangThai?: LichTrangThai;
}

class LichChayRepository extends BaseRepository<LichChay> {
  /** Lịch trên một máy. */
  async findByMay(maMay: string): Promise<LichChay[]> {
    const all = await this.findAll();
    return all.filter((l) => l.MaMay === maMay);
  }

  /** Lịch của một lệnh. */
  async findByLenh(maLenh: string): Promise<LichChay[]> {
    const all = await this.findAll();
    return all.filter((l) => l.MaLenh === maLenh);
  }

  /** Lịch có phần GIAO với khoảng [from, to] (chuỗi ngày/giờ). */
  async findInRange(from: string, to: string): Promise<LichChay[]> {
    const a = parseLocal(from).getTime();
    const b = parseLocal(to).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return [];
    const all = await this.findAll();
    return all.filter((l) => {
      const s = parseLocal(l.BatDauDuKien).getTime();
      const e = parseLocal(l.KetThucDuKien).getTime();
      if (Number.isNaN(s) || Number.isNaN(e)) return false;
      return e > a && s < b;
    });
  }

  /** Sinh MaLich dạng LC-NNN. */
  async generateMaLich(): Promise<string> {
    const all = await this.findAll();
    return nextShortId(
      all.map((l) => l.MaLich),
      "LC",
    );
  }

  /**
   * Tạo một dòng lịch. Toàn vẹn tham chiếu (mục 5.5) + gate SanSang (mục 2.2):
   *  - MaLenh phải tồn tại.
   *  - Lệnh phải Sẵn sàng (TrangThaiFile = SanSang) mới được xếp — nếu chưa → chặn.
   *  - MaMay (nếu có) phải tồn tại trong tab May.
   */
  async create(
    input: LichChayCreateInput,
    actorEmail: string,
  ): Promise<LichChay> {
    const lenh = await lenhSanXuatRepository.findById(input.MaLenh);
    if (!lenh) {
      throw new RepositoryError(
        `Không tồn tại lệnh "${input.MaLenh}" — không thể tạo lịch chạy.`,
      );
    }
    if (!coTheXepLich(lenh)) {
      throw new RepositoryError(
        `Lệnh "${input.MaLenh}" chưa Sẵn sàng (TrangThaiFile=${lenh.TrangThaiFile}) nên chưa được xếp lịch.`,
      );
    }
    if (input.MaMay) {
      const may = await mayRepository.findById(input.MaMay);
      if (!may) {
        throw new RepositoryError(`Không tồn tại máy "${input.MaMay}".`);
      }
    }
    const lich: LichChay = {
      MaLich: await this.generateMaLich(),
      MaLenh: input.MaLenh,
      CongDoan: input.CongDoan,
      MaMay: input.MaMay,
      ThuTu: input.ThuTu,
      BatDauDuKien: input.BatDauDuKien,
      KetThucDuKien: input.KetThucDuKien,
      NguoiPhuTrach: input.NguoiPhuTrach ?? "",
      TrangThai: input.TrangThai ?? "ChoChay",
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    };
    return this.insert(lich);
  }

  /** Cập nhật lịch theo khóa, tự set audit. */
  async update(
    maLich: string,
    patch: Partial<LichChay>,
    actorEmail: string,
  ): Promise<LichChay> {
    return this.updateByKey(maLich, {
      ...patch,
      NguoiCapNhat: actorEmail,
      NgayCapNhat: nowStamp(),
    });
  }

  /**
   * Tính lại ThuTu (1..n theo BatDauDuKien) cho toàn bộ lịch trên MỘT máy.
   * Chỉ ghi lại dòng có ThuTu thay đổi (giảm số lần ghi Sheets).
   */
  async capNhatThuTuMay(maMay: string, actorEmail: string): Promise<void> {
    if (!maMay) return;
    const ds = (await this.findByMay(maMay)).sort((a, b) =>
      a.BatDauDuKien < b.BatDauDuKien
        ? -1
        : a.BatDauDuKien > b.BatDauDuKien
          ? 1
          : 0,
    );
    for (let i = 0; i < ds.length; i++) {
      const l = ds[i];
      if (l && l.ThuTu !== i + 1) {
        await this.update(l.MaLich, { ThuTu: i + 1 }, actorEmail);
      }
    }
  }
}

export const lichChayRepository = new LichChayRepository({
  tab: "LichChay",
  columns: LICH_CHAY_COLUMNS,
  primaryKey: "MaLich",
  numberColumns: ["ThuTu"],
});
