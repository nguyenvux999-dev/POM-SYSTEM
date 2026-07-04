import type { ReactNode } from "react";
import type {
  DoUuTien,
  DonHangTrangThai,
  LichTrangThai,
  LenhTrangThai,
  MayTrangThai,
  MucDo,
  PhatSinhTrangThai,
  TrangThaiFile,
} from "@/lib/domain/enums";
import {
  NHAN_DO_UU_TIEN,
  NHAN_DON_HANG_TRANG_THAI,
  NHAN_LENH_TRANG_THAI,
  NHAN_LICH_TRANG_THAI,
  NHAN_MAY_TRANG_THAI,
  NHAN_MUC_DO,
  NHAN_PHAT_SINH_TRANG_THAI,
  NHAN_TRANG_THAI_FILE,
} from "@/lib/domain/labels";

type Tone = "gray" | "blue" | "green" | "red" | "amber";

const TONE_CLASS: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
};

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

const DON_HANG_TONE: Record<DonHangTrangThai, Tone> = {
  Moi: "gray",
  ChoCheBan: "amber",
  DaLenLich: "blue",
  DangSanXuat: "blue",
  HoanThanh: "green",
  TreHen: "red",
  Huy: "gray",
};

const FILE_TONE: Record<TrangThaiFile, Tone> = {
  ChoFile: "gray",
  DangCheBan: "amber",
  DaRaKem: "blue",
  SanSang: "green",
};

const UU_TIEN_TONE: Record<DoUuTien, Tone> = {
  Thap: "gray",
  BinhThuong: "gray",
  Cao: "amber",
  Gap: "red",
};

const LENH_TONE: Record<LenhTrangThai, Tone> = {
  ChoLenLich: "gray",
  DaLenLich: "blue",
  DangChay: "amber",
  HoanThanh: "green",
};

const LICH_TONE: Record<LichTrangThai, Tone> = {
  ChoChay: "gray",
  DangChay: "amber",
  Xong: "green",
};

const MAY_TONE: Record<MayTrangThai, Tone> = {
  HoatDong: "green",
  BaoTri: "amber",
  Hong: "red",
};

const PHAT_SINH_TONE: Record<PhatSinhTrangThai, Tone> = {
  Moi: "amber",
  DangXuLy: "blue",
  DaXong: "green",
};

const MUC_DO_TONE: Record<MucDo, Tone> = {
  Nhe: "gray",
  TrungBinh: "amber",
  NghiemTrong: "red",
};

export function BadgeDonHang({ value }: { value: DonHangTrangThai }) {
  return <Badge tone={DON_HANG_TONE[value]}>{NHAN_DON_HANG_TRANG_THAI[value]}</Badge>;
}

export function BadgeFile({ value }: { value: TrangThaiFile }) {
  return <Badge tone={FILE_TONE[value]}>{NHAN_TRANG_THAI_FILE[value]}</Badge>;
}

export function BadgeUuTien({ value }: { value: DoUuTien }) {
  return <Badge tone={UU_TIEN_TONE[value]}>{NHAN_DO_UU_TIEN[value]}</Badge>;
}

export function BadgeLenh({ value }: { value: LenhTrangThai }) {
  return <Badge tone={LENH_TONE[value]}>{NHAN_LENH_TRANG_THAI[value]}</Badge>;
}

export function BadgeLich({ value }: { value: LichTrangThai }) {
  return <Badge tone={LICH_TONE[value]}>{NHAN_LICH_TRANG_THAI[value]}</Badge>;
}

export function BadgeMay({ value }: { value: MayTrangThai }) {
  return <Badge tone={MAY_TONE[value]}>{NHAN_MAY_TRANG_THAI[value]}</Badge>;
}

export function BadgePhatSinh({ value }: { value: PhatSinhTrangThai }) {
  return (
    <Badge tone={PHAT_SINH_TONE[value]}>{NHAN_PHAT_SINH_TRANG_THAI[value]}</Badge>
  );
}

export function BadgeMucDo({ value }: { value: MucDo }) {
  return <Badge tone={MUC_DO_TONE[value]}>{NHAN_MUC_DO[value]}</Badge>;
}
