import Link from "next/link";
import { lenhSanXuatRepository } from "@/lib/repositories/lenhSanXuat";
import { donHangRepository } from "@/lib/repositories/donHang";
import { lichChayRepository } from "@/lib/repositories/lichChay";
import { mayRepository } from "@/lib/repositories/may";
import { phatSinhRepository } from "@/lib/repositories/phatSinh";
import { danhSachCanXepLai, danhSachNguyCoTre } from "@/lib/domain/reschedule";
import { formatLocal, nowLocal, todayVN } from "@/lib/domain/datetime";
import { PhatSinhBoard, type CanXepLaiVM, type PhatSinhVM } from "./board";

export const dynamic = "force-dynamic";

export default async function PhatSinhPage() {
  const [lenhList, donList, lichAll, mayList, phatSinhAll] = await Promise.all([
    lenhSanXuatRepository.findAll(),
    donHangRepository.findAll(),
    lichChayRepository.findAll(),
    mayRepository.findAll(),
    phatSinhRepository.findAll(),
  ]);

  const donMap = new Map(donList.map((d) => [d.MaDon, d]));
  const lenhMap = new Map(lenhList.map((l) => [l.MaLenh, l]));

  const phatSinh: PhatSinhVM[] = phatSinhAll
    .slice()
    .sort((a, b) =>
      a.ThoiGian < b.ThoiGian ? 1 : a.ThoiGian > b.ThoiGian ? -1 : 0,
    )
    .map((p) => {
      const lenh = lenhMap.get(p.MaLenh);
      const d = lenh ? donMap.get(lenh.MaDon) : undefined;
      return {
        MaPhatSinh: p.MaPhatSinh,
        MaLenh: p.MaLenh,
        MaLSXXuong: lenh?.MaLSXXuong ?? "",
        Loai: p.Loai,
        MoTa: p.MoTa,
        MucDo: p.MucDo,
        AnhHuongTienDo: p.AnhHuongTienDo,
        HuongXuLy: p.HuongXuLy,
        TrangThai: p.TrangThai,
        ThoiGian: p.ThoiGian,
        TenSanPham: d?.TenSanPham ?? "",
        KhachHang: d?.KhachHang ?? "",
      };
    });

  const canXepLai: CanXepLaiVM[] = danhSachCanXepLai(
    lenhList,
    phatSinhAll,
    lichAll,
    mayList,
  ).map(({ lenh, lyDo }) => {
    const d = donMap.get(lenh.MaDon);
    return {
      MaLenh: lenh.MaLenh,
      MaLSXXuong: lenh.MaLSXXuong ?? "",
      TenSanPham: d?.TenSanPham ?? "",
      KhachHang: d?.KhachHang ?? "",
      HanHoanThanh: lenh.HanHoanThanh,
      CongDoanCanLam: lenh.CongDoanCanLam,
      SoToIn: lenh.SoToIn ?? 0,
      BuHaoPhanTram: lenh.BuHaoPhanTram ?? 0,
      boiPhatSinh: lyDo.boiPhatSinh,
      boiMayLoi: lyDo.boiMayLoi,
      congDoanBiKet: lyDo.congDoanBiKet.map((c) => ({
        CongDoan: c.CongDoan,
        tenMay: c.tenMay,
        mayTrangThai: c.mayTrangThai,
      })),
    };
  });

  const nguyCoTre = danhSachNguyCoTre({
    lenhs: lenhList,
    lichAll,
    mayList,
    donMap,
    now: nowLocal(),
    homNay: todayVN(),
  });

  return (
    // Tiêu đề cố định; board tự quản lý vùng cuộn dữ liệu bên trong.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Phát sinh & Cần xử lý</h1>
          <p className="text-sm text-gray-500">
            Ghi sự cố, xem lệnh/đơn bị ảnh hưởng và xếp lại nhanh.
          </p>
        </div>
        <Link
          href="/phat-sinh/new"
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          ＋ Ghi phát sinh
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <PhatSinhBoard
          phatSinh={phatSinh}
          canXepLai={canXepLai}
          nguyCoTre={nguyCoTre}
          may={mayList}
          lichAll={lichAll}
          now={formatLocal(nowLocal())}
        />
      </div>
    </div>
  );
}
