"use client";

import { useState, useTransition } from "react";
import {
  TRANG_THAI_FILE,
  type DoUuTien,
  type TrangThaiFile,
} from "@/lib/domain/enums";
import { NHAN_TRANG_THAI_FILE } from "@/lib/domain/labels";
import { coTheXepLich } from "@/lib/domain/gate";
import { BadgeUuTien } from "@/components/status-badge";
import { MaLenhHienThi, ThongSoChips } from "@/components/lenh-specs";
import { capNhatTrangThaiFile } from "./actions";

export interface TheLenh {
  MaLenh: string;
  MaDon: string;
  TrangThaiFile: TrangThaiFile;
  DoUuTien: DoUuTien;
  TenSanPham: string;
  KhachHang: string;
  HanHoanThanh: string;
  MaLSXXuong: string;
  SoMau: string;
  LoaiGiay: string;
  KhoGiay: string;
  KhoIn: string;
  SoTrang: number;
}

export function Kanban({ cards: initial }: { cards: TheLenh[] }) {
  const [cards, setCards] = useState<TheLenh[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(maLenh: string, target: TrangThaiFile) {
    const prev = cards;
    const card = prev.find((c) => c.MaLenh === maLenh);
    if (!card || card.TrangThaiFile === target) return;

    setError(null);
    // Optimistic: đổi ngay trên màn.
    setCards((cur) =>
      cur.map((c) =>
        c.MaLenh === maLenh ? { ...c, TrangThaiFile: target } : c,
      ),
    );

    startTransition(async () => {
      const res = await capNhatTrangThaiFile(maLenh, target);
      if (!res.ok) {
        // Rollback nếu ghi lỗi.
        setCards(prev);
        setError(`Không lưu được ${maLenh}: ${res.error}`);
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TRANG_THAI_FILE.map((col) => {
          const colCards = cards.filter((c) => c.TrangThaiFile === col);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, col);
                setDragId(null);
              }}
              className="flex min-h-[8rem] flex-col rounded-lg border border-gray-200 bg-gray-50"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                <span className="text-sm font-semibold text-gray-700">
                  {NHAN_TRANG_THAI_FILE[col]}
                </span>
                <span className="rounded-full bg-white px-2 text-xs text-gray-500">
                  {colCards.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {colCards.map((c) => (
                  <div
                    key={c.MaLenh}
                    draggable
                    onDragStart={() => setDragId(c.MaLenh)}
                    onDragEnd={() => setDragId(null)}
                    className="cursor-grab rounded-md border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <MaLenhHienThi
                        maLenh={c.MaLenh}
                        maLSXXuong={c.MaLSXXuong}
                        size="xs"
                      />
                      <BadgeUuTien value={c.DoUuTien} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {c.TenSanPham || "—"}
                    </p>
                    <p className="text-xs text-gray-500">{c.KhachHang}</p>
                    <div className="mt-1">
                      <ThongSoChips
                        SoMau={c.SoMau}
                        LoaiGiay={c.LoaiGiay}
                        KhoGiay={c.KhoGiay}
                        KhoIn={c.KhoIn}
                        SoTrang={c.SoTrang}
                      />
                    </div>
                    {c.HanHoanThanh && (
                      <p className="mt-1 text-xs text-gray-500">
                        Hạn: {c.HanHoanThanh}
                      </p>
                    )}

                    {coTheXepLich(c) && (
                      <p className="mt-1 text-xs font-medium text-green-700">
                        ✅ Sẵn sàng xếp lịch
                      </p>
                    )}

                    {/* Đổi trạng thái bằng dropdown — dùng tốt trên mobile */}
                    <select
                      value={c.TrangThaiFile}
                      onChange={(e) =>
                        move(c.MaLenh, e.target.value as TrangThaiFile)
                      }
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      aria-label={`Đổi trạng thái file ${c.MaLenh}`}
                    >
                      {TRANG_THAI_FILE.map((t) => (
                        <option key={t} value={t}>
                          {NHAN_TRANG_THAI_FILE[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {colCards.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-gray-400">
                    (trống)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Mẹo: kéo-thả thẻ giữa các cột (desktop) hoặc dùng ô chọn trạng thái trên
        mỗi thẻ (mobile).
      </p>
    </div>
  );
}
