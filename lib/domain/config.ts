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
