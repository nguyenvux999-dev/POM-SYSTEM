/**
 * Tham số nghiệp vụ chỉnh tay — GOM MỘT CHỖ.
 *
 * ⚠️ CẦN PLANNER XÁC NHẬN: mọi giá trị dưới đây hiện là MẶC ĐỊNH TẠM để hệ thống
 * chạy được ngay. Sửa số ở đây, KHÔNG sửa code, khi có số thật của xưởng.
 */

/** ⚠️ CẦN PLANNER XÁC NHẬN — số giờ làm việc mỗi ngày (đổi 12 nếu tính tăng ca). */
export const GIO_LAM_VIEC_MOI_NGAY = 8;

/** ⚠️ CẦN PLANNER XÁC NHẬN — số ngày dự phòng cho chế bản/ra kẽm. */
export const DEM_CHE_BAN_NGAY = 1;

/** ⚠️ CẦN PLANNER XÁC NHẬN — số giờ dự phòng đóng gói + giao hàng. */
export const DEM_DONG_GOI_GIAO_GIO = 4;

/**
 * Map công đoạn → loại máy để ước tính thời lượng.
 * Công đoạn KHÔNG có trong map này (DongGhim/EpKim/Khac) → dùng CONGDOAN_KHAC_*.
 */
export const CONGDOAN_MAY: Record<string, string> = {
  In: "InOffset",
  CanMang: "CanMang",
  Be: "Be",
  Dan: "Dan",
};

/** ⚠️ CẦN PLANNER XÁC NHẬN — make-ready (phút) cho công đoạn không có máy chuyên. */
export const CONGDOAN_KHAC_MAKEREADY_PHUT = 30;

/** ⚠️ CẦN PLANNER XÁC NHẬN — năng suất giả định (tờ/giờ) cho công đoạn không có máy chuyên. */
export const CONGDOAN_KHAC_NANGSUAT = 5000;

// ---------------------------------------------------------------------------
// Pha 2 — tham số xếp lịch (dùng ở lib/domain/datetime.ts + schedule.ts)
// ---------------------------------------------------------------------------

/** ⚠️ CẦN PLANNER XÁC NHẬN — giờ bắt đầu ca làm mỗi ngày, dạng "HH:mm". */
export const GIO_BAT_DAU_LAM = "08:00";

/**
 * ⚠️ CẦN PLANNER XÁC NHẬN — các ngày nghỉ cố định trong tuần.
 * Quy ước JS: 0=Chủ nhật, 1=Thứ 2, …, 6=Thứ 7.
 * Mặc định [] = xưởng chạy cả tuần. Ví dụ nghỉ Chủ nhật: `[0]`.
 */
export const NGAY_NGHI: readonly number[] = [];

// ---------------------------------------------------------------------------
// Pha 3 — xử lý phát sinh & cảnh báo trễ (lib/domain/reschedule.ts)
// ---------------------------------------------------------------------------

/**
 * ⚠️ CẦN PLANNER XÁC NHẬN — ngưỡng "nguy cơ trễ": đơn/lệnh có hạn trong vòng N
 * ngày kể từ hôm nay được coi là nguy cơ trễ khi có sự cố ảnh hưởng.
 */
export const DE_DOA_TRE_NGAY = 2;

// ---------------------------------------------------------------------------
// Pha 4 — báo cáo & archive
// ---------------------------------------------------------------------------

/**
 * ⚠️ CẦN PLANNER XÁC NHẬN — ngưỡng tải máy (0..1) để coi là "nghẽn/cổ chai"
 * trong báo cáo tải máy (mặc định 85%).
 */
export const NGUONG_NGHEN_MAY = 0.85;

/**
 * ⚠️ CẦN PLANNER XÁC NHẬN — chỉ archive đơn HoanThanh có ngày hoàn thành cũ hơn
 * N ngày (giữ sheet chính nhẹ). Xem scripts/archive.ts.
 */
export const ARCHIVE_SAU_NGAY = 30;
