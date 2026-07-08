import { mayRepository } from "@/lib/repositories/may";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { maSanPhamRepository } from "@/lib/repositories/maSanPham";
import type { MaSanPham } from "@/lib/domain/types";
import { formatLocal, nowLocal } from "@/lib/domain/datetime";
import { chuoiTimKiemLenh, nhanMaSP } from "@/components/lenh-specs";
import { Board, type ChoXepVM, type LichVM } from "./board";

export const dynamic = "force-dynamic";

export default async function XepLichPage() {
  const [may, lenhList, donList, lichList, maSanPhamAll] = await Promise.all([
    mayRepository.findAll(),
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    lichChayRepository.findAll(),
    maSanPhamRepository.findAll(),
  ]);

  const donMap = new Map(donList.map((d) => [d.MaDon, d]));
  const lenhMap = new Map(lenhList.map((l) => [l.MaLenh, l]));
  // Join MaSanPham theo MaLenh trong RAM (đọc cả tab 1 lần qua cache,
  // không gọi API theo từng lệnh).
  const maSPByLenh = new Map<string, MaSanPham[]>();
  for (const m of maSanPhamAll) {
    const arr = maSPByLenh.get(m.MaLenh) ?? [];
    arr.push(m);
    maSPByLenh.set(m.MaLenh, arr);
  }

  // 2.3 — Lệnh chờ xếp: chỉ SanSang + ChoLenLich (sắp xếp cuối cùng ở client).
  const choXep: ChoXepVM[] = lenhList
    .filter(
      (l) => l.TrangThaiFile === "SanSang" && l.TrangThai === "ChoLenLich",
    )
    .map((l) => {
      const d = donMap.get(l.MaDon);
      const maSP = maSPByLenh.get(l.MaLenh) ?? [];
      return {
        MaLenh: l.MaLenh,
        MaDon: l.MaDon,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
        HanHoanThanh: l.HanHoanThanh,
        DoUuTien: l.DoUuTien,
        CongDoanCanLam: l.CongDoanCanLam,
        SoToIn: l.SoToIn ?? 0,
        SoMau: d?.SoMau ?? "",
        LoaiGiay: d?.LoaiGiay ?? "",
        KhoThanhPham: d?.KhoThanhPham ?? "",
        MaLSXXuong: l.MaLSXXuong ?? "",
        KhoGiay: l.KhoGiay ?? "",
        KhoIn: l.KhoIn ?? "",
        SoTrang: l.SoTrang ?? 0,
        BuHaoPhanTram: l.BuHaoPhanTram ?? 0,
        MaSP: nhanMaSP(maSP),
        TimKiem: chuoiTimKiemLenh({
          tenSanPham: d?.TenSanPham,
          maLenh: l.MaLenh,
          maLSXXuong: l.MaLSXXuong,
          maSP,
        }),
      };
    });

  // Lịch đã chốt, join lệnh + đơn để hiển thị + tính trợ lý.
  const lich: LichVM[] = lichList.map((l) => {
    const lenh = lenhMap.get(l.MaLenh);
    const d = lenh ? donMap.get(lenh.MaDon) : undefined;
    const maSP = maSPByLenh.get(l.MaLenh) ?? [];
    return {
      ...l,
      TenSanPham: d?.TenSanPham ?? "",
      KhachHang: d?.KhachHang ?? "",
      HanHoanThanh: lenh?.HanHoanThanh ?? "",
      DoUuTien: lenh?.DoUuTien ?? "BinhThuong",
      SoMau: d?.SoMau ?? "",
      LoaiGiay: d?.LoaiGiay ?? "",
      KhoThanhPham: d?.KhoThanhPham ?? "",
      MaLSXXuong: lenh?.MaLSXXuong ?? "",
      KhoGiay: lenh?.KhoGiay ?? "",
      KhoIn: lenh?.KhoIn ?? "",
      SoTrang: lenh?.SoTrang ?? 0,
      MaSP: nhanMaSP(maSP),
      TimKiem: chuoiTimKiemLenh({
        tenSanPham: d?.TenSanPham,
        maLenh: l.MaLenh,
        maLSXXuong: lenh?.MaLSXXuong,
        maSP,
      }),
    };
  });

  return (
    // Tiêu đề cố định; Board chiếm phần còn lại và tự quản lý vùng cuộn dữ liệu.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">Xếp lịch</h1>
        <p className="text-sm text-gray-500">
          Gán lệnh <strong>đã Sẵn sàng</strong> lên máy — hệ thống tự tính giờ
          bắt đầu/kết thúc và cảnh báo trễ hạn, gom màu/khổ, tải máy. Bạn vẫn là
          người quyết định.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <Board
          may={may}
          lich={lich}
          choXep={choXep}
          now={formatLocal(nowLocal())}
        />
      </div>
    </div>
  );
}
