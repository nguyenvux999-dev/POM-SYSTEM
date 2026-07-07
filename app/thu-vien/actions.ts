"use server";

/**
 * Server Actions cho Thư viện sản phẩm (module tra cứu ĐỘC LẬP).
 *
 * Ảnh upload SERVER-SIDE lên Vercel Blob (BLOB_READ_WRITE_TOKEN chỉ sống ở
 * server, không bao giờ lộ ra client). Sheet chỉ lưu URL ảnh (cột AnhUrl).
 * Validate định dạng/kích thước ở đây là chốt CUỐI — UI có kiểm trước nhưng
 * không tin UI.
 */

import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { auth } from "@/lib/auth/config";
import {
  thuVienSanPhamRepository,
  type ThuVienSanPhamInput,
} from "@/lib/repositories/thuVienSanPham";
import { RepositoryError } from "@/lib/repositories/base";
import type { ThuVienSanPham } from "@/lib/domain/types";

/** Định dạng ảnh chấp nhận → đuôi file (đồng bộ với accept của input ở UI). */
const ANH_DINH_DANG: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Giới hạn kích thước ảnh: 4 MB. */
const ANH_TOI_DA_BYTES = 4 * 1024 * 1024;

type KetQua<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function actorEmail(): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? "unknown";
}

function loi(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

/** Kiểm tra file ảnh (định dạng + kích thước). Hợp lệ → null, lỗi → thông báo. */
function validateAnh(file: File): string | null {
  if (!ANH_DINH_DANG[file.type]) {
    return "Ảnh phải là JPG, PNG hoặc WEBP.";
  }
  if (file.size > ANH_TOI_DA_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Ảnh ${mb} MB — vượt giới hạn 4 MB. Hãy giảm kích thước rồi thử lại.`;
  }
  return null;
}

/** Tên file an toàn từ mã sản phẩm: bỏ dấu tiếng Việt, chỉ giữ [a-z0-9-]. */
function tenFileAnToan(maSanPham: string): string {
  const slug = maSanPham
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "san-pham";
}

/** Upload ảnh lên Vercel Blob (server-side), trả về URL công khai. */
async function uploadAnh(file: File, maSanPham: string): Promise<string> {
  const duoi = ANH_DINH_DANG[file.type];
  const blob = await put(`san-pham/${tenFileAnToan(maSanPham)}.${duoi}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/**
 * Xóa một ảnh trên Blob theo URL — best-effort: lỗi xóa ảnh (mạng, ảnh đã mất...)
 * KHÔNG được chặn thao tác chính, chỉ log lại. Bỏ qua URL không phải Blob.
 */
async function xoaAnhBlob(url: string): Promise<void> {
  if (!url || !url.includes(".blob.vercel-storage.com")) return;
  try {
    await del(url);
  } catch (err) {
    console.warn(`[thu-vien] Không xóa được ảnh cũ trên Blob: ${url}`, err);
  }
}

/** Đọc file ảnh từ FormData; input trống (không chọn) → null. */
function docAnhForm(formData: FormData): File | null {
  const file = formData.get("anh");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

/** Đọc + chuẩn hóa các trường chữ từ FormData (AnhUrl xử lý riêng). */
function docTruongForm(
  formData: FormData,
): Omit<ThuVienSanPhamInput, "AnhUrl"> {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    MaSanPham: s("MaSanPham"),
    TenSanPham: s("TenSanPham"),
    KhachHang: s("KhachHang"),
    KhoThanhPham: s("KhoThanhPham"),
    LoaiGiay: s("LoaiGiay"),
    GhiChu: s("GhiChu"),
  };
}

function validateTruong(t: { MaSanPham: string; TenSanPham: string }): string | null {
  if (!t.MaSanPham) return "Vui lòng nhập Mã sản phẩm.";
  if (!t.TenSanPham) return "Vui lòng nhập Tên sản phẩm.";
  return null;
}

/** THÊM sản phẩm mới (kèm ảnh nếu có). Trùng mã → lỗi, ảnh đã lỡ upload được dọn lại. */
export async function themSanPham(
  formData: FormData,
): Promise<KetQua<{ sanPham: ThuVienSanPham }>> {
  try {
    const truong = docTruongForm(formData);
    const invalid = validateTruong(truong);
    if (invalid) return loi(invalid);

    const file = docAnhForm(formData);
    if (file) {
      const loiAnh = validateAnh(file);
      if (loiAnh) return loi(loiAnh);
    }

    const email = await actorEmail();
    // Upload ảnh TRƯỚC khi ghi sheet; nếu ghi sheet thất bại thì dọn ảnh vừa lên.
    const anhUrl = file ? await uploadAnh(file, truong.MaSanPham) : "";
    try {
      const sanPham = await thuVienSanPhamRepository.create(
        { ...truong, AnhUrl: anhUrl },
        email,
      );
      revalidatePath("/thu-vien");
      return { ok: true, sanPham };
    } catch (err) {
      await xoaAnhBlob(anhUrl);
      throw err;
    }
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/**
 * SỬA sản phẩm (mọi trường, kể cả đổi mã). Chọn ảnh mới → upload ảnh mới,
 * ghi sheet xong mới xóa ảnh cũ trên Blob (best-effort).
 */
export async function suaSanPham(
  maSanPham: string,
  formData: FormData,
): Promise<KetQua<{ sanPham: ThuVienSanPham }>> {
  try {
    const truong = docTruongForm(formData);
    const invalid = validateTruong(truong);
    if (invalid) return loi(invalid);

    const hienTai = await thuVienSanPhamRepository.findById(maSanPham);
    if (!hienTai) return loi(`Không tồn tại sản phẩm "${maSanPham}".`);

    const file = docAnhForm(formData);
    if (file) {
      const loiAnh = validateAnh(file);
      if (loiAnh) return loi(loiAnh);
    }

    const email = await actorEmail();
    const anhUrlMoi = file ? await uploadAnh(file, truong.MaSanPham) : null;
    let sanPham: ThuVienSanPham;
    try {
      sanPham = await thuVienSanPhamRepository.capNhat(
        maSanPham,
        { ...truong, AnhUrl: anhUrlMoi ?? hienTai.AnhUrl },
        email,
      );
    } catch (err) {
      // Ghi sheet thất bại → dọn ảnh mới vừa upload, giữ nguyên ảnh cũ.
      if (anhUrlMoi) await xoaAnhBlob(anhUrlMoi);
      throw err;
    }
    // Ghi xong mới xóa ảnh cũ (đổi ảnh thành công thì ảnh cũ thành rác).
    if (anhUrlMoi && hienTai.AnhUrl && hienTai.AnhUrl !== anhUrlMoi) {
      await xoaAnhBlob(hienTai.AnhUrl);
    }

    revalidatePath("/thu-vien");
    return { ok: true, sanPham };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}

/** XÓA sản phẩm: xóa bản ghi trên sheet rồi dọn ảnh trên Blob (best-effort). */
export async function xoaSanPham(maSanPham: string): Promise<KetQua> {
  try {
    const hienTai = await thuVienSanPhamRepository.findById(maSanPham);
    if (!hienTai) return loi(`Không tồn tại sản phẩm "${maSanPham}".`);

    await thuVienSanPhamRepository.deleteByKey(maSanPham);
    await xoaAnhBlob(hienTai.AnhUrl);

    revalidatePath("/thu-vien");
    return { ok: true };
  } catch (e) {
    if (e instanceof RepositoryError) return loi(e.message);
    return loi(e instanceof Error ? e.message : String(e));
  }
}
