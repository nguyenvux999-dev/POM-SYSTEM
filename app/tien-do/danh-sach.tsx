"use client";

/**
 * Danh sách lệnh đang chạy của trang Tiến độ + ô tìm kiếm.
 * Tìm kiếm chỉ LỌC hiển thị phía client trên dữ liệu đã tải (không gọi API
 * khi gõ); dữ liệu và thống kê phía trên vẫn do server tính đủ.
 */

import Link from "next/link";
import { useState } from "react";
import type { CongDoan } from "@/lib/domain/enums";
import type { LenhSanXuat } from "@/lib/domain/types";
import { NHAN_CONG_DOAN } from "@/lib/domain/labels";
import { BadgeLenh } from "@/components/status-badge";
import {
  khopTimKiem,
  MaLenhHienThi,
  MaSPHienThi,
} from "@/components/lenh-specs";
import { OTimKiemLenh } from "@/components/lenh-search";

export interface TienDoItemVM {
  MaLenh: string;
  MaLSXXuong: string;
  TrangThai: LenhSanXuat["TrangThai"];
  TenSanPham: string;
  KhachHang: string;
  SoToIn: number;
  HanHoanThanh: string;
  total: number;
  done: number;
  pct: number;
  tre: boolean;
  /** Công đoạn đang làm; undefined = đã xong tất cả công đoạn. */
  congDoanHienTai?: CongDoan;
  /** Số lượng đạt mới nhất của công đoạn hiện tại; undefined = chưa bắt đầu. */
  soLuongDat?: number;
  /** Nhãn các mã SP thuộc lệnh (hiển thị "mã đầu +N mã"). */
  MaSP: string[];
  /** Chuỗi tìm kiếm dựng sẵn ở server (xem chuoiTimKiemLenh). */
  TimKiem: string;
}

export function TienDoDanhSach({ items }: { items: TienDoItemVM[] }) {
  const [tuKhoa, setTuKhoa] = useState("");
  const hien = items.filter((x) => khopTimKiem(x.TimKiem, tuKhoa));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <OTimKiemLenh value={tuKhoa} onChange={setTuKhoa} />

      <div className="min-h-0 space-y-2 overflow-y-auto">
        {hien.map((x) => (
          <Link
            key={x.MaLenh}
            href={`/tien-do/${x.MaLenh}`}
            className={`block rounded-lg border bg-white p-3 hover:bg-gray-50 ${
              x.tre ? "border-red-300" : "border-gray-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <MaLenhHienThi maLenh={x.MaLenh} maLSXXuong={x.MaLSXXuong} />
              <BadgeLenh value={x.TrangThai} />
              {x.tre && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  ⚠️ Nguy cơ trễ
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {x.TenSanPham || "—"}{" "}
              <span className="text-xs font-normal text-gray-400">
                · {x.KhachHang}
              </span>
            </p>
            <p className="mt-0.5">
              <MaSPHienThi nhan={x.MaSP} />
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${x.pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {x.done}/{x.total} công đoạn
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {x.congDoanHienTai ? (
                <>
                  Hiện tại: <strong>{NHAN_CONG_DOAN[x.congDoanHienTai]}</strong>
                  {x.soLuongDat !== undefined
                    ? ` · đạt ${x.soLuongDat.toLocaleString()}/${x.SoToIn.toLocaleString()}`
                    : " · chưa bắt đầu"}
                </>
              ) : (
                "Đã xong tất cả công đoạn"
              )}{" "}
              · Hạn: {x.HanHoanThanh || "—"}
            </p>
          </Link>
        ))}
        {hien.length === 0 &&
          (items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              Chưa có lệnh nào đang chạy. Hãy xếp lịch ở mục{" "}
              <Link href="/xep-lich" className="text-brand hover:underline">
                Xếp lịch
              </Link>
              .
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              Không có lệnh nào khớp từ khóa.
            </p>
          ))}
      </div>
    </div>
  );
}
