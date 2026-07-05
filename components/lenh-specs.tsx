/**
 * Hiển thị dùng chung cho LỆNH SẢN XUẤT (thuần, không state → dùng được ở cả
 * server component lẫn client component).
 *
 *  - `MaLenhHienThi`: mã xưởng (MaLSXXuong) làm mã chính (đậm) nếu có, kèm MaLenh
 *    nội bộ nhỏ màu xám bên cạnh; không có mã xưởng → chỉ hiện MaLenh.
 *  - `ThongSoChips`: dải "chip" thông số kỹ thuật gọn gàng (số màu, khổ giấy, khổ
 *    in, loại giấy, số trang) — bỏ qua trường trống. SoMau/LoaiGiay lấy từ DonHang.
 */

/** Mã lệnh: ưu tiên mã xưởng (đậm) + MaLenh nội bộ (xám nhỏ). */
export function MaLenhHienThi({
  maLenh,
  maLSXXuong,
  size = "sm",
  bold = false,
}: {
  maLenh: string;
  maLSXXuong?: string;
  /** "xs"/"sm" cho thẻ, "base"/"lg" cho tiêu đề chi tiết. */
  size?: "xs" | "sm" | "base" | "lg";
  /** Khi KHÔNG có mã xưởng: in đậm MaLenh (dùng cho tiêu đề). */
  bold?: boolean;
}) {
  const main =
    size === "lg"
      ? "text-lg"
      : size === "base"
        ? "text-base"
        : size === "sm"
          ? "text-sm"
          : "text-xs";
  const xuong = (maLSXXuong ?? "").trim();
  if (xuong) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className={`font-mono font-semibold text-gray-900 ${main}`}>
          {xuong}
        </span>
        <span className="font-mono text-[11px] text-gray-400">{maLenh}</span>
      </span>
    );
  }
  return (
    <span
      className={`font-mono text-gray-900 ${main} ${bold ? "font-semibold" : ""}`}
    >
      {maLenh}
    </span>
  );
}

export interface ThongSoKyThuat {
  /** Từ DonHang. */
  SoMau?: string;
  /** Từ LenhSanXuat. */
  KhoGiay?: string;
  /** Từ LenhSanXuat. */
  KhoIn?: string;
  /** Từ DonHang. */
  LoaiGiay?: string;
  /** Từ LenhSanXuat; chỉ hiện khi > 0. */
  SoTrang?: number;
}

/** Dải chip thông số kỹ thuật; trả về null nếu không có thông số nào. */
export function ThongSoChips(props: ThongSoKyThuat) {
  const chips: { label: string; value: string }[] = [];
  const add = (label: string, value?: string) => {
    if (value && value.trim()) chips.push({ label, value: value.trim() });
  };
  add("Số màu", props.SoMau);
  add("Khổ giấy", props.KhoGiay);
  add("Khổ in", props.KhoIn);
  add("Giấy", props.LoaiGiay);
  if (props.SoTrang && props.SoTrang > 0) {
    chips.push({ label: "Số trang", value: String(props.SoTrang) });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c.label}
          className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-200"
        >
          <span className="text-gray-400">{c.label}:</span> {c.value}
        </span>
      ))}
    </div>
  );
}
