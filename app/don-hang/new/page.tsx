import Link from "next/link";
import { mayRepository } from "@/lib/repositories/may";
import { bangNangLucTuMay } from "@/lib/domain/estimate";
import { todayVN } from "@/lib/domain/datetime";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  // Suy bảng năng lực máy ở server rồi truyền xuống form (client) để tính khả thi
  // ngay khi gõ — không cần gọi Sheets từ client.
  const may = await mayRepository.findAll();
  const bangNangLuc = bangNangLucTuMay(may);
  const homNay = todayVN();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tạo đơn hàng</h1>
        <Link href="/don-hang" className="text-sm text-brand hover:underline">
          ← Danh sách đơn
        </Link>
      </div>
      <OrderForm bangNangLuc={bangNangLuc} homNay={homNay} />
    </div>
  );
}
