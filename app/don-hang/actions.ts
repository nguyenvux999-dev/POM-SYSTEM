"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { maSanPhamRepository } from "@/lib/repositories/maSanPham";
import { RepositoryError } from "@/lib/repositories/base";
import {
  moiLichDaXong,
  quyenSuaMaSP,
  quyenSuaXoaLenh,
  suyTrangThaiDonTuLenh,
  type QuyenMaSP,
} from "@/lib/domain/gate";
import type { LenhSanXuat } from "@/lib/domain/types";
import type {
  DonHangInput,
  LenhDraftInput,
  LenhEditInput,
  MaSanPhamInput,
} from "@/lib/domain/inputs";

/** Email người đang đăng nhập (đã qua middleware — luôn có, phòng hờ fallback). */
async function actorEmail(): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? "unknown";
}

function loi(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function taoDon(
  input: DonHangInput,
): Promise<{ ok: true; maDon: string } | { ok: false; error: string }> {
  try {
    if (!input.TenSanPham?.trim()) return loi("Thiếu Tên sản phẩm.");
    if (!input.KhachHang?.trim()) return loi("Thiếu Khách hàng.");
    if (!input.NgayGiaoHang?.trim()) return loi("Thiếu Ngày giao hàng.");
    if (!Number.isFinite(input.SoLuong) || input.SoLuong <= 0) {
      return loi("Số lượng phải là số dương.");
    }

    const email = await actorEmail();
    const don = await donHangRepository.create(input, email);
    revalidatePath("/don-hang");
    return { ok: true, maDon: don.MaDon };
  } catch (e) {
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Tạo DUY NHẤT 1 lệnh cho một đơn (mô hình 1 đơn ↔ 1 lệnh) + các dòng mã sản phẩm
 * mô tả. Chặn nếu đơn đã có lệnh. SoToIn bắt buộc (> 0) để tính được thời lượng.
 */
export async function taoLenh(
  maDon: string,
  lenh: LenhDraftInput,
  maSanPham: MaSanPhamInput[],
): Promise<{ ok: true; maLenh: string } | { ok: false; error: string }> {
  try {
    if (!lenh.CongDoanCanLam?.length) {
      return loi("Lệnh cần chọn ít nhất 1 công đoạn.");
    }
    if (!(Number(lenh.SoToIn) > 0)) {
      return loi("Cần nhập Số tờ in (> 0) để tính được thời lượng.");
    }
    const dsMa = (maSanPham ?? []).filter(
      (m) => m.MaSanPham?.trim() || m.TenSanPham?.trim(),
    );
    if (dsMa.length === 0) {
      return loi("Cần ít nhất 1 mã sản phẩm trong lệnh.");
    }

    const email = await actorEmail();
    const don = await donHangRepository.findById(maDon);
    if (!don) return loi(`Không tồn tại đơn hàng ${maDon}.`);

    // Mô hình 1–1: chặn nếu đơn đã có lệnh (repo cũng kiểm lại khi insert).
    if (await lenhSanXuatRepository.findOneByMaDon(maDon)) {
      return loi("Đơn này đã có lệnh sản xuất.");
    }

    const created = await lenhSanXuatRepository.create(
      {
        MaDon: maDon,
        MoTaCongViec: lenh.MoTaCongViec ?? "",
        CongDoanCanLam: lenh.CongDoanCanLam.join(";"),
        DoUuTien: lenh.DoUuTien,
        HanHoanThanh: lenh.HanHoanThanh ?? "",
        MaLSXXuong: lenh.MaLSXXuong?.trim() || undefined,
        SoTrang: lenh.SoTrang,
        KhoGiay: lenh.KhoGiay?.trim() || undefined,
        KhoIn: lenh.KhoIn?.trim() || undefined,
        BuHaoPhanTram: lenh.BuHaoPhanTram,
        SoToIn: lenh.SoToIn,
      },
      email,
    );

    // Các dòng mã sản phẩm (thuần mô tả), gắn theo MaLenh.
    for (const m of dsMa) {
      await maSanPhamRepository.create(
        {
          MaLenh: created.MaLenh,
          MaSanPham: m.MaSanPham?.trim() ?? "",
          TenSanPham: m.TenSanPham?.trim() ?? "",
          KichThuoc: m.KichThuoc?.trim() ?? "",
          SoLuong: Number.isFinite(m.SoLuong) ? m.SoLuong : 0,
        },
        email,
      );
    }

    // Sau khi tạo lệnh, đơn chuyển sang "Chờ chế bản".
    await donHangRepository.update(maDon, { TrangThai: "ChoCheBan" }, email);

    revalidateLenh(maDon);
    return { ok: true, maLenh: created.MaLenh };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** Chuẩn hóa % bù hao để SO SÁNH thay đổi: trống/0/không hợp lệ đều coi là 0 (mặc định). */
function chuanBuHao(v?: number): number {
  return v != null && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Revalidate mọi trang chịu ảnh hưởng bởi thay đổi lệnh (sửa/xóa). */
function revalidateLenh(maDon: string): void {
  revalidatePath(`/don-hang/${maDon}`);
  revalidatePath("/don-hang");
  revalidatePath("/che-ban");
  revalidatePath("/xep-lich");
  revalidatePath("/tien-do");
  revalidatePath("/phat-sinh");
}

/**
 * Đánh dấu lệnh CẦN XẾP LẠI bằng cách tạo một PhatSinh AnhHuongTienDo (tái dùng
 * cơ chế suy-ra ở Pha 3 — KHÔNG thêm enum/cột). Bỏ qua nếu lệnh ĐÃ có phát sinh
 * mở ảnh hưởng tiến độ (tránh nhân bản mỗi lần sửa).
 */
async function danhDauCanXepLai(
  maLenh: string,
  moTa: string,
  email: string,
): Promise<void> {
  const ds = await phatSinhRepository.findByLenh(maLenh);
  const daCo = ds.some((p) => p.AnhHuongTienDo && p.TrangThai !== "DaXong");
  if (daCo) return;
  await phatSinhRepository.create(
    {
      MaLenh: maLenh,
      Loai: "Khac",
      MoTa: moTa,
      MucDo: "TrungBinh",
      AnhHuongTienDo: true,
      HuongXuLy: "",
    },
    email,
  );
}

/**
 * SỬA một lệnh. Kiểm QUYỀN theo dữ liệu con thật (coLichChay/coTienDo/HoanThanh),
 * KHÔNG tin UI:
 *  - HoanThanh → chặn hoàn toàn.
 *  - Có tiến độ → chỉ ghi trường VÔ HẠI; đổi trường ảnh hưởng lịch → chặn.
 *  - Đã xếp lịch (chưa chạy) → cho đổi tất cả, đổi trường ảnh hưởng lịch → đánh dấu cần xếp lại.
 *  - Chưa xếp → tự do.
 */
export async function suaLenh(
  maLenh: string,
  input: LenhEditInput,
): Promise<{ ok: true; canhBaoXepLai: boolean } | { ok: false; error: string }> {
  try {
    if (!input.CongDoanCanLam?.length) {
      return loi("Mỗi lệnh cần chọn ít nhất 1 công đoạn.");
    }
    const email = await actorEmail();
    const lenh = await lenhSanXuatRepository.findById(maLenh);
    if (!lenh) return loi(`Không tồn tại lệnh ${maLenh}.`);

    const [lichCuaLenh, coTienDo] = await Promise.all([
      lichChayRepository.findByLenh(maLenh),
      tienDoRepository.coTienDo(maLenh),
    ]);
    const quyen = quyenSuaXoaLenh({
      trangThai: lenh.TrangThai,
      coLichChay: lichCuaLenh.length > 0,
      coTienDo,
      moiLichXong: moiLichDaXong(lichCuaLenh),
    });
    if (quyen.chiDoc) return loi(quyen.lyDoKhoaSua ?? "Lệnh chỉ đọc.");

    // Phát hiện thay đổi THẬT ở trường ẢNH HƯỞNG LỊCH (so với giá trị hiện tại).
    const cdMoi = input.CongDoanCanLam.join(";");
    const doiCongDoan = cdMoi !== lenh.CongDoanCanLam;
    const doiBuHao =
      chuanBuHao(input.BuHaoPhanTram) !== chuanBuHao(lenh.BuHaoPhanTram);
    const doiHan = (input.HanHoanThanh ?? "") !== (lenh.HanHoanThanh ?? "");
    const doiSoToIn = (input.SoToIn ?? 0) !== (lenh.SoToIn ?? 0);
    const doiAnhHuongLich = doiCongDoan || doiBuHao || doiHan || doiSoToIn;

    if (doiAnhHuongLich && !quyen.suaAnhHuongLich) {
      return loi(
        quyen.lyDoKhoaSua ??
          "Không thể đổi công đoạn/bù hao/hạn/số tờ in của lệnh này.",
      );
    }

    // Luôn ghi trường VÔ HẠI; trường ẢNH HƯỞNG LỊCH chỉ ghi khi được phép.
    const patch: Partial<LenhSanXuat> = {
      MoTaCongViec: input.MoTaCongViec ?? "",
      MaLSXXuong: input.MaLSXXuong?.trim() || "",
      DoUuTien: input.DoUuTien,
      SoTrang: input.SoTrang,
      KhoGiay: input.KhoGiay?.trim() || "",
      KhoIn: input.KhoIn?.trim() || "",
    };
    if (quyen.suaAnhHuongLich) {
      patch.CongDoanCanLam = cdMoi;
      patch.BuHaoPhanTram = input.BuHaoPhanTram;
      patch.HanHoanThanh = input.HanHoanThanh ?? "";
      patch.SoToIn = input.SoToIn;
    }
    await lenhSanXuatRepository.update(maLenh, patch, email);

    let canhBaoXepLai = false;
    if (doiAnhHuongLich && quyen.canhBaoXepLai) {
      canhBaoXepLai = true;
      const cac: string[] = [];
      if (doiCongDoan) cac.push("công đoạn");
      if (doiBuHao) cac.push("bù hao");
      if (doiHan) cac.push("hạn");
      if (doiSoToIn) cac.push("số tờ in");
      await danhDauCanXepLai(
        maLenh,
        `Đã sửa ${cac.join(", ")} sau khi đã xếp lịch — lịch cũ không còn đúng, cần xếp lại.`,
        email,
      );
    }

    revalidateLenh(lenh.MaDon);
    return { ok: true, canhBaoXepLai };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/**
 * XÓA một lệnh. Kiểm QUYỀN theo dữ liệu con thật (không tin UI). Khi được phép xóa:
 * dọn TẤT CẢ LichChay của lệnh TRƯỚC (không để mồ côi) → xóa lệnh → cập nhật lại
 * ThuTu máy bị đụng → tính lại trạng thái ĐƠN cha cho nhất quán.
 */
export async function xoaLenh(
  maLenh: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const email = await actorEmail();
    const lenh = await lenhSanXuatRepository.findById(maLenh);
    if (!lenh) return loi(`Không tồn tại lệnh ${maLenh}.`);
    const maDon = lenh.MaDon;

    const [lichCuaLenh, coTienDo] = await Promise.all([
      lichChayRepository.findByLenh(maLenh),
      tienDoRepository.coTienDo(maLenh),
    ]);
    const quyen = quyenSuaXoaLenh({
      trangThai: lenh.TrangThai,
      coLichChay: lichCuaLenh.length > 0,
      coTienDo,
      moiLichXong: moiLichDaXong(lichCuaLenh),
    });
    if (!quyen.xoaDuoc) return loi(quyen.lyDoKhoaXoa ?? "Không thể xóa lệnh này.");

    // 1) Dọn dữ liệu con TRƯỚC (không để mồ côi): mọi LichChay + mọi PhatSinh
    //    (gồm marker "cần xếp lại" tự sinh) + mọi mã sản phẩm. TienDo đã bị chặn ở trên.
    const touched = await lichChayRepository.xoaTheoLenh(maLenh);
    await phatSinhRepository.xoaTheoLenh(maLenh);
    await maSanPhamRepository.xoaTheoLenh(maLenh);
    // 2) Xóa lệnh.
    await lenhSanXuatRepository.deleteByKey(maLenh);
    // 3) Tính lại ThuTu các lịch còn lại trên máy bị đụng.
    for (const m of touched) await lichChayRepository.capNhatThuTuMay(m, email);

    // 4) Cập nhật trạng thái ĐƠN cha cho nhất quán (không đụng Huy/TreHen — người đặt tay).
    const con = await lenhSanXuatRepository.findByMaDon(maDon);
    const don = await donHangRepository.findById(maDon);
    if (don && don.TrangThai !== "Huy" && don.TrangThai !== "TreHen") {
      const moi = suyTrangThaiDonTuLenh(con);
      if (moi !== don.TrangThai) {
        await donHangRepository.update(maDon, { TrangThai: moi }, email);
      }
    }

    revalidateLenh(maDon);
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// SỬA / THÊM / XÓA mã sản phẩm (dòng MaSanPham) của một lệnh ĐÃ TẠO.
// Mã SP thuần MÔ TẢ — không nuôi công thức thời lượng (giờ in bám SoToIn cấp
// lệnh) nên các action này KHÔNG đánh dấu "cần xếp lại", KHÔNG tính lại lịch,
// KHÔNG đổi trạng thái lệnh/đơn.
// ---------------------------------------------------------------------------

/** Mã SP chỉ hiển thị ở các trang đơn hàng — KHÔNG revalidate trang lịch/tiến độ. */
function revalidateMaSP(maDon: string): void {
  revalidatePath(`/don-hang/${maDon}`);
  revalidatePath("/don-hang");
}

/** Validate nội dung một dòng mã SP (dùng chung thêm/sửa — UI cũng kiểm trước). */
function validateNoiDungMaSP(input: MaSanPhamInput): string | null {
  if (!input.MaSanPham?.trim() && !input.TenSanPham?.trim()) {
    return "Cần nhập Mã SP hoặc Tên sản phẩm.";
  }
  if (!Number.isFinite(input.SoLuong) || input.SoLuong <= 0) {
    return "Số lượng phải là số > 0.";
  }
  return null;
}

/**
 * Quyền thao tác mã SP của một lệnh theo DỮ LIỆU CON THẬT (không tin UI):
 * tái dùng quyenSuaXoaLenh (coLichChay/coTienDo/HoanThanh) rồi suy quyenSuaMaSP.
 * Lệnh không tồn tại → null.
 */
async function quyenMaSPCuaLenh(
  maLenh: string,
): Promise<{ maDon: string; quyenMa: QuyenMaSP } | null> {
  const lenh = await lenhSanXuatRepository.findById(maLenh);
  if (!lenh) return null;
  const [lichCuaLenh, coTienDo] = await Promise.all([
    lichChayRepository.findByLenh(maLenh),
    tienDoRepository.coTienDo(maLenh),
  ]);
  const quyen = quyenSuaXoaLenh({
    trangThai: lenh.TrangThai,
    coLichChay: lichCuaLenh.length > 0,
    coTienDo,
    moiLichXong: moiLichDaXong(lichCuaLenh),
  });
  return { maDon: lenh.MaDon, quyenMa: quyenSuaMaSP(quyen.muc) };
}

/** THÊM một mã sản phẩm vào lệnh đã tạo (MaDongSP mới do repo sinh, dạng MSP-NNN). */
export async function themMaSP(
  maLenh: string,
  input: MaSanPhamInput,
): Promise<{ ok: true; maDongSP: string } | { ok: false; error: string }> {
  try {
    const invalid = validateNoiDungMaSP(input);
    if (invalid) return loi(invalid);

    const ctx = await quyenMaSPCuaLenh(maLenh);
    if (!ctx) return loi(`Không tồn tại lệnh ${maLenh}.`);
    if (!ctx.quyenMa.themXoaDuoc) {
      return loi(ctx.quyenMa.lyDoKhoa ?? "Không thể thêm mã sản phẩm.");
    }

    const email = await actorEmail();
    const created = await maSanPhamRepository.create(
      {
        MaLenh: maLenh,
        MaSanPham: input.MaSanPham?.trim() ?? "",
        TenSanPham: input.TenSanPham?.trim() ?? "",
        KichThuoc: input.KichThuoc?.trim() ?? "",
        SoLuong: input.SoLuong,
      },
      email,
    );

    revalidateMaSP(ctx.maDon);
    return { ok: true, maDongSP: created.MaDongSP };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** SỬA nội dung một mã sản phẩm (khóa MaDongSP/MaLenh KHÔNG đổi). */
export async function suaMaSP(
  maDongSP: string,
  input: MaSanPhamInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const invalid = validateNoiDungMaSP(input);
    if (invalid) return loi(invalid);

    const dong = await maSanPhamRepository.findById(maDongSP);
    if (!dong) return loi(`Không tồn tại dòng mã sản phẩm ${maDongSP}.`);
    const ctx = await quyenMaSPCuaLenh(dong.MaLenh);
    if (!ctx) return loi(`Không tồn tại lệnh ${dong.MaLenh}.`);
    if (!ctx.quyenMa.suaDuoc) {
      return loi(ctx.quyenMa.lyDoKhoa ?? "Không thể sửa mã sản phẩm.");
    }

    const email = await actorEmail();
    await maSanPhamRepository.update(
      maDongSP,
      {
        MaSanPham: input.MaSanPham?.trim() ?? "",
        TenSanPham: input.TenSanPham?.trim() ?? "",
        KichThuoc: input.KichThuoc?.trim() ?? "",
        SoLuong: input.SoLuong,
      },
      email,
    );

    revalidateMaSP(ctx.maDon);
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** XÓA một mã sản phẩm. Lệnh luôn phải còn TỐI THIỂU 1 mã → chặn xóa dòng cuối. */
export async function xoaMaSP(
  maDongSP: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const dong = await maSanPhamRepository.findById(maDongSP);
    if (!dong) return loi(`Không tồn tại dòng mã sản phẩm ${maDongSP}.`);
    const ctx = await quyenMaSPCuaLenh(dong.MaLenh);
    if (!ctx) return loi(`Không tồn tại lệnh ${dong.MaLenh}.`);
    if (!ctx.quyenMa.themXoaDuoc) {
      return loi(ctx.quyenMa.lyDoKhoa ?? "Không thể xóa mã sản phẩm.");
    }

    // Bất biến: mỗi lệnh có ít nhất 1 mã — kiểm ở server, KHÔNG tin UI.
    const dsCungLenh = await maSanPhamRepository.findByLenh(dong.MaLenh);
    if (dsCungLenh.length <= 1) {
      return loi("Lệnh phải có ít nhất 1 mã sản phẩm — không thể xóa dòng cuối cùng.");
    }

    await maSanPhamRepository.deleteByKey(maDongSP);

    revalidateMaSP(ctx.maDon);
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}
