import { NextResponse } from "next/server";
import { mayRepository } from "@/lib/repositories/may";

// Luôn chạy động (đọc dữ liệu thật qua repository), không cache ở tầng route.
export const dynamic = "force-dynamic";

/**
 * Health check: đọc tab May qua repository để xác nhận chuỗi
 * Auth → Sheets client → Cache → Repository hoạt động.
 * (Được middleware bảo vệ — cần đăng nhập; gọi qua trình duyệt sau khi đăng nhập.)
 */
export async function GET() {
  try {
    const may = await mayRepository.findAll();
    return NextResponse.json({
      ok: true,
      machineCount: may.length,
      machines: may.map((m) => ({ MaMay: m.MaMay, TenMay: m.TenMay })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
