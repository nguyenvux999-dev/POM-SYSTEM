/**
 * Đọc & kiểm tra biến môi trường.
 *
 * Nguyên tắc: validate LƯỜI (lazy) — chỉ kiểm tra khi thực sự cần dùng
 * (khi gọi Sheets / Auth lúc runtime), KHÔNG kiểm tra ở thời điểm import module.
 * Nhờ vậy `npm run build` không đòi hỏi phải có secret thật.
 *
 * Thiếu biến bắt buộc -> ném lỗi tường minh (không nuốt lỗi, không crash mơ hồ).
 */

/** Lỗi cấu hình môi trường — dùng để phân biệt với lỗi runtime khác. */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new EnvError(
      `[ENV] Thiếu biến môi trường bắt buộc: ${name}. ` +
        `Hãy thêm vào .env.local (tham khảo .env.example).`,
    );
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new EnvError(
      `[ENV] Biến ${name} phải là số dương, nhận được: "${raw}".`,
    );
  }
  return parsed;
}

/**
 * Credential Service Account để truy cập Google Sheets (server-side only).
 *
 * ⚠️ PRIVATE_KEY: khi lưu trong biến môi trường, ký tự xuống dòng thường bị
 * escape thành chuỗi literal "\n". Phải khôi phục lại xuống dòng thật bằng
 * .replace(/\\n/g, "\n") trước khi đưa vào google.auth.JWT.
 */
export function getGoogleEnv(): {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
} {
  const clientEmail = required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = required("SPREADSHEET_ID");
  return { clientEmail, privateKey, spreadsheetId };
}

/** Config cho Auth.js (Google OAuth). */
export function getAuthEnv(): {
  secret: string;
  googleId: string;
  googleSecret: string;
} {
  return {
    secret: required("AUTH_SECRET"),
    googleId: required("AUTH_GOOGLE_ID"),
    googleSecret: required("AUTH_GOOGLE_SECRET"),
  };
}

/**
 * Danh sách email được phép đăng nhập (allowlist), ngăn cách bằng dấu phẩy.
 * Trả về mảng email đã chuẩn hóa (lowercase, trim).
 */
export function getAllowedEmails(): string[] {
  const raw = required("ALLOWED_EMAILS");
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/** TTL cache toàn sheet (giây). Mặc định 30s, cấu hình qua CACHE_TTL_SECONDS. */
export function getCacheTtlSeconds(): number {
  return optionalNumber("CACHE_TTL_SECONDS", 30);
}
