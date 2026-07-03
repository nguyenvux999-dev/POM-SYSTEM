/** Danh sách khu vực nghiệp vụ dùng chung cho thanh điều hướng & trang chủ. */
export interface NavItem {
  href: string;
  label: string;
  /** Pha sẽ triển khai (hiển thị nhãn "sắp làm"). */
  pha: string;
  icon: string;
  desc: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/don-hang",
    label: "Đơn hàng",
    pha: "Pha 1",
    icon: "📋",
    desc: "Tiếp nhận & theo dõi đơn hàng",
  },
  {
    href: "/che-ban",
    label: "Chế bản",
    pha: "Pha 1",
    icon: "🖨️",
    desc: "Kiểm tra file & trạng thái kẽm",
  },
  {
    href: "/xep-lich",
    label: "Xếp lịch",
    pha: "Pha 2",
    icon: "🗓️",
    desc: "Bảng sắp xếp lệnh lên máy",
  },
  {
    href: "/tien-do",
    label: "Tiến độ",
    pha: "Pha 2",
    icon: "📈",
    desc: "Cập nhật tiến độ ngoài xưởng",
  },
  {
    href: "/phat-sinh",
    label: "Phát sinh",
    pha: "Pha 3",
    icon: "⚠️",
    desc: "Ghi sự cố & sắp xếp lại",
  },
  {
    href: "/bao-cao",
    label: "Báo cáo",
    pha: "Pha 4",
    icon: "📊",
    desc: "Báo cáo & xuất file",
  },
];
