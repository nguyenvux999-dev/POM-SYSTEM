import type { ReactNode } from "react";
import type {
  DoUuTien,
  DonHangTrangThai,
  TrangThaiFile,
} from "@/lib/domain/enums";
import {
  NHAN_DO_UU_TIEN,
  NHAN_DON_HANG_TRANG_THAI,
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

export function BadgeDonHang({ value }: { value: DonHangTrangThai }) {
  return <Badge tone={DON_HANG_TONE[value]}>{NHAN_DON_HANG_TRANG_THAI[value]}</Badge>;
}

export function BadgeFile({ value }: { value: TrangThaiFile }) {
  return <Badge tone={FILE_TONE[value]}>{NHAN_TRANG_THAI_FILE[value]}</Badge>;
}

export function BadgeUuTien({ value }: { value: DoUuTien }) {
  return <Badge tone={UU_TIEN_TONE[value]}>{NHAN_DO_UU_TIEN[value]}</Badge>;
}
