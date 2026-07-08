import Link from "next/link";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    href: "/bao-cao/ngay",
    icon: "📅",
    title: "Báo cáo ngày",
    desc: "Đã xong / đang chạy / nguy cơ trễ (+ lý do) trong ngày.",
  },
  {
    href: "/bao-cao/tai-may",
    icon: "🏭",
    title: "Tải máy theo tuần",
    desc: "% sử dụng từng máy → phát hiện máy nghẽn (cổ chai).",
  },
  {
    href: "/bao-cao/dung-han",
    icon: "🎯",
    title: "Tỷ lệ đúng hạn",
    desc: "% đơn giao đúng hạn theo tháng + danh sách đơn trễ.",
  },
  {
    href: "/bao-cao/phat-sinh",
    icon: "⚠️",
    title: "Thống kê phát sinh",
    desc: "Loại sự cố hay gặp, phân bố mức độ, % ảnh hưởng tiến độ.",
  },
];

export default function BaoCaoPage() {
  return (
    <div className="h-full space-y-4 overflow-y-auto">
      <div>
        <h1 className="text-xl font-semibold">Báo cáo</h1>
        <p className="text-sm text-gray-500">
          Số liệu tính realtime từ dữ liệu vận hành. Chọn một báo cáo:
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-brand hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{r.icon}</span>
              <span className="font-medium">{r.title}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
