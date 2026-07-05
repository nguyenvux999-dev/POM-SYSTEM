"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { tienDoRepository } from "@/lib/repositories/tienDo";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { RepositoryError } from "@/lib/repositories/base";
import {
  moiLichDaXong,
  quyenSuaXoaLenh,
  suyTrangThaiDonTuLenh,
} from "@/lib/domain/gate";
import type { LenhSanXuat } from "@/lib/domain/types";
import type {
  DonHangInput,
  LenhDraftInput,
  LenhEditInput,
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

export async function taoNhieuLenh(
  maDon: string,
  drafts: LenhDraftInput[],
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  try {
    if (!drafts.length) return loi("Chưa có lệnh nào để tạo.");
    for (const d of drafts) {
      if (!d.CongDoanCanLam?.length) {
        return loi("Mỗi lệnh cần chọn ít nhất 1 công đoạn.");
      }
    }

    const email = await actorEmail();

    // Toàn vẹn tham chiếu: kiểm tra đơn tồn tại (repo cũng kiểm lại mỗi lần insert).
    const don = await donHangRepository.findById(maDon);
    if (!don) return loi(`Không tồn tại đơn hàng ${maDon}.`);

    let created = 0;
    for (const d of drafts) {
      await lenhSanXuatRepository.create(
        {
          MaDon: maDon,
          MoTaCongViec: d.MoTaCongViec ?? "",
          CongDoanCanLam: d.CongDoanCanLam.join(";"),
          DoUuTien: d.DoUuTien,
          HanHoanThanh: d.HanHoanThanh ?? "",
          MaLSXXuong: d.MaLSXXuong?.trim() || undefined,
          SoTrang: d.SoTrang,
          KhoGiay: d.KhoGiay?.trim() || undefined,
          KhoIn: d.KhoIn?.trim() || undefined,
          BuHaoPhanTram: d.BuHaoPhanTram,
        },
        email,
      );
      created++;
    }

    // Sau khi tạo lệnh, đơn chuyển sang "Chờ chế bản".
    await donHangRepository.update(maDon, { TrangThai: "ChoCheBan" }, email);

    revalidatePath(`/don-hang/${maDon}`);
    revalidatePath("/don-hang");
    revalidatePath("/che-ban");
    return { ok: true, created };
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
    const doiAnhHuongLich = doiCongDoan || doiBuHao || doiHan;

    if (doiAnhHuongLich && !quyen.suaAnhHuongLich) {
      return loi(
        quyen.lyDoKhoaSua ??
          "Không thể đổi công đoạn/bù hao/hạn của lệnh này.",
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
    }
    await lenhSanXuatRepository.update(maLenh, patch, email);

    let canhBaoXepLai = false;
    if (doiAnhHuongLich && quyen.canhBaoXepLai) {
      canhBaoXepLai = true;
      const cac: string[] = [];
      if (doiCongDoan) cac.push("công đoạn");
      if (doiBuHao) cac.push("bù hao");
      if (doiHan) cac.push("hạn");
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
    //    (gồm marker "cần xếp lại" tự sinh). TienDo đã được chặn ở quy tắc trên.
    const touched = await lichChayRepository.xoaTheoLenh(maLenh);
    await phatSinhRepository.xoaTheoLenh(maLenh);
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
