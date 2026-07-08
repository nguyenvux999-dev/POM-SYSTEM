"use client";

/**
 * Ô tìm kiếm lệnh dùng chung cho chế bản / xếp lịch / tiến độ.
 * Controlled input — chỉ lọc hiển thị phía client trên dữ liệu đã tải,
 * KHÔNG phát sinh request khi gõ. Kèm nút "Xóa lọc" khi có từ khóa.
 */
export function OTimKiemLenh({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm theo sản phẩm, mã SP hoặc mã LSX"
        aria-label="Tìm kiếm lệnh"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Xóa lọc
        </button>
      )}
    </div>
  );
}
