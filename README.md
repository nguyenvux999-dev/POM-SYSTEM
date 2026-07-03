# Quản lý Lệnh Sản xuất (In Offset) — Nền tảng (Pha 0)

Hệ thống hỗ trợ planner sắp xếp lệnh sản xuất cho xưởng in offset nhỏ.
Đây là **phần móng (Pha 0)** — CHƯA có màn hình nghiệp vụ; chỉ có hạ tầng:
Auth, tầng truy cập dữ liệu (Repository), cache, seed và khung điều hướng.

## Ngăn xếp công nghệ

- **Next.js (App Router) + TypeScript (strict) + Tailwind CSS**
- Triển khai trên **Vercel**
- Database: **Google Sheets** (đọc/ghi server-side qua **Service Account**, thư viện `googleapis`)
- Đăng nhập: **Auth.js (NextAuth v5)** + Google OAuth, giới hạn theo **allowlist email**

## Kiến trúc (nguyên tắc cốt lõi)

- **Repository Pattern**: mọi truy cập dữ liệu qua `lib/repositories/*`. Không gọi thẳng Sheets API ở route/component. Đổi sang Postgres sau này chỉ cần viết lại lớp trong repository.
- **Cache toàn sheet ở server** (`lib/sheets/cache.ts`): đọc cả một tab một lần, giữ RAM với TTL ngắn (mặc định 30s), lọc/join trong code; invalidate sau mỗi lần ghi.
- **Không gọi Sheets từ client**: toàn bộ đọc/ghi chạy server-side; service-account key không bao giờ lộ ra client (các module Sheets có `import "server-only"`).
- **Map row ↔ object theo dòng tiêu đề**: đọc header (dòng 1) để biết vị trí cột, không hardcode index.
- **`TienDo` append-only**: chỉ `append` + `findAll`.

```
app/           # UI + route (server components, server actions)
lib/
  env.ts       # đọc & kiểm tra biến môi trường (lazy)
  sheets/      # client googleapis + cache RAM
  repositories/# BaseRepository + 7 repo cụ thể
  domain/      # types, enums, columns (nguồn chân lý cột)
  auth/        # cấu hình Auth.js + allowlist
components/    # nav, placeholder
scripts/seed.ts
middleware.ts  # chặn route chưa đăng nhập
```

---

## A. Tạo Service Account & share sheet (6 bước — làm thủ công một lần)

1. **Tạo/chọn project** trên [Google Cloud Console](https://console.cloud.google.com/).
2. **Bật Google Sheets API**: *APIs & Services → Library →* tìm **Google Sheets API** → **Enable**.
3. **Tạo Service Account**: *APIs & Services → Credentials → Create credentials → Service account* → đặt tên → Create.
4. **Tạo key JSON**: mở service account vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải file về. Trong file có `client_email` và `private_key`.
5. **Tạo Google Spreadsheet** mới. Lấy `SPREADSHEET_ID` từ URL: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`.
6. **Share spreadsheet** cho `client_email` của service account với quyền **Editor** (nút Share → dán email → chọn Editor). *(Bỏ bước này là nguyên nhân lỗi 403 phổ biến nhất.)*

> **Cấu hình Google OAuth (cho đăng nhập planner):** *Credentials → Create credentials → OAuth client ID → Web application*. Thêm **Authorized redirect URI**:
> - Local: `http://localhost:3000/api/auth/callback/google`
> - Production: `https://<domain-vercel>/api/auth/callback/google`
>
> Lấy **Client ID** và **Client secret** để điền vào `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

---

## B. Điền `.env.local`

Sao chép `.env.example` thành `.env.local` rồi điền:

```bash
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

| Biến | Lấy từ |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` trong file JSON key |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` trong file JSON key (xem lưu ý bên dưới) |
| `SPREADSHEET_ID` | ID trong URL spreadsheet |
| `AUTH_SECRET` | chạy `npx auth secret` (hoặc `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth client ID/secret |
| `ALLOWED_EMAILS` | email planner được phép, cách nhau bằng dấu phẩy |
| `CACHE_TTL_SECONDS` | (tùy chọn) mặc định 30 |

> ⚠️ **PRIVATE_KEY**: dán toàn bộ key trong **dấu ngoặc kép**, một dòng, **giữ nguyên các `\n`** (ký tự literal). Code tự chuyển `\n` thành xuống dòng thật khi dùng (`.replace(/\\n/g, "\n")`). Ví dụ:
> ```
> GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
> ```

> 🔒 **KHÔNG commit** `.env.local` hay file JSON key (đã nằm trong `.gitignore`).

---

## C. Chạy seed & dev

```bash
npm install       # cài dependencies
npm run seed      # tạo/kiểm tra 7 tab + header + nạp dữ liệu mẫu May (idempotent)
npm run dev       # chạy local tại http://localhost:3000
```

Lệnh hữu ích khác:

```bash
npm run build     # build production (không cần secret — env đọc lười)
npm run typecheck # kiểm tra kiểu TypeScript
npm run lint      # ESLint
npm run format    # Prettier
```

---

## D. Checklist smoke test Pha 0

- [ ] `npm run seed` → 7 tab (`DonHang, LenhSanXuat, May, LichChay, TienDo, PhatSinh, NguoiDung`) có header đúng; tab `May` có **6 dòng** mẫu. Chạy lần 2 **không** nhân đôi.
- [ ] `npm run dev` → mở `http://localhost:3000` khi **chưa đăng nhập** → bị chuyển về `/login`.
- [ ] Đăng nhập bằng email **trong** `ALLOWED_EMAILS` → vào được; email **ngoài** danh sách → bị từ chối (quay lại `/login` kèm thông báo).
- [ ] Trang chủ hiển thị **6 máy** đọc qua repository (khối "smoke test") → chứng minh chuỗi **Auth → Sheets client → Cache → Repository** chạy thông. (Hoặc gọi `GET /api/health` sau khi đăng nhập, trả `{ ok: true, machineCount: 6 }`.)

Đạt cả 4 = **xong Pha 0**.

---

## E. Mô hình dữ liệu (7 tab)

| Tab | Khóa chính | Ghi chú |
|---|---|---|
| `DonHang` | `MaDon` | Đơn hàng |
| `LenhSanXuat` | `MaLenh` | Lệnh sản xuất (FK `MaDon`) |
| `May` | `MaMay` | Máy móc (có seed mẫu) |
| `LichChay` | `MaLich` | Lịch chạy máy (FK `MaLenh`, `MaMay`) |
| `TienDo` | `MaLog` | Nhật ký tiến độ — **append-only** |
| `PhatSinh` | `MaPhatSinh` | Sự cố phát sinh (FK `MaLenh`) |
| `NguoiDung` | `Email` | Phân quyền |

Chi tiết cột: xem `lib/domain/columns.ts` (nguồn chân lý) và `lib/domain/types.ts`.
Tab `00_HuongDan` (nếu có) được app **bỏ qua**.

---

## F. Giả định đã đặt ra khi làm Pha 0

1. **Không dùng thư viện `google-spreadsheet`** — dùng `googleapis` chính thức theo yêu cầu.
2. **Env đọc lười (lazy)**: chỉ validate khi cần dùng (runtime), nên `npm run build` chạy được mà không cần secret thật. Thiếu biến khi chạy → lỗi tường minh (`EnvError` / `SheetsError`).
3. **`import "server-only"`** được thêm vào các module Sheets để chặn vô tình import ở client. Vì vậy **script seed tự khởi tạo Sheets client** và chỉ import các module "thuần" (`lib/env`, `lib/domain/columns`) — không import lớp repository.
4. **Nguồn chân lý về cột** đặt ở `lib/domain/columns.ts` (module thuần) để cả repository lẫn seed dùng chung, tránh trùng lặp và tránh kéo `server-only` vào seed.
5. **Ngày/giờ xử lý như chuỗi** ở Pha 0 (chưa parse `Date`). Đọc Sheets với `valueRenderOption=UNFORMATTED_VALUE` rồi chuẩn hóa mọi ô về `string`.
6. **Ép kiểu khi đọc**: cột số rỗng → `0`; cột boolean → `TRUE`/`true` thành `true`, còn lại `false`. Ghi boolean thành `TRUE`/`FALSE`, ghi bằng `valueInputOption=RAW` (không để Sheets tự diễn giải).
7. **Cache là best-effort trong tiến trình**: trên Vercel serverless mỗi instance giữ cache riêng, TTL ngắn; không phải nguồn chân lý. Đã có retry nhẹ cho lỗi 429.
8. **Thanh điều hướng chỉ hiện khi đã đăng nhập** (layout kiểm tra session một lần); trang `/login` không có nav.
9. **Nút đăng xuất/đăng nhập dùng Server Action** (giữ key & luồng auth ở server), không tạo client component riêng.
10. **`updateByKey` định vị dòng theo khóa chính** (đọc → sửa → ghi lại đúng dòng qua `values.update`), chưa có optimistic locking (`Version`) — đúng phạm vi một-người-dùng của MVP.
11. **Thêm 2 file ngoài cấu trúc tối thiểu**: `lib/domain/columns.ts` (nguồn chân lý cột, lý do ở trên) và `components/placeholder-page.tsx` + `components/nav/nav-items.ts` (tách để tái dùng giữa nav và trang chủ). Không thêm state manager hay ORM.
12. **Không làm ở Pha 0**: mọi màn hình nghiệp vụ, công thức thời lượng, kiểm tra hạn giao, 3 trợ lý quyết định, optimistic locking, auto-scheduler, tích hợp kho, phân quyền phức tạp.

---

## G. Pha 1 — Tiếp nhận đơn & Chế bản (cách dùng)

Luồng nghiệp vụ:

1. **`/don-hang/new` — Tạo đơn** (mobile-first). Nhập thông tin đơn; chọn *công đoạn dự kiến* → hệ thống hiện **cảnh báo khả thi hạn giao** ngay khi gõ (đỏ nếu hạn quá gấp — chỉ cảnh báo, không chặn). Lưu → đơn ở trạng thái **Mới**.
2. **`/don-hang` — Danh sách đơn**. Lọc theo trạng thái + khách hàng; mới nhất trước. Click mã đơn để mở chi tiết.
3. **`/don-hang/[MaDon]` — Chi tiết đơn + tạo lệnh (1→N)**. Mặc định 1 lệnh, nút **"＋ Thêm lệnh"** để tách nhiều lệnh cho cùng đơn. Mỗi lệnh: mô tả, chọn **công đoạn theo thứ tự**, độ ưu tiên, hạn hoàn thành. Lưu → lệnh tạo với `TrangThaiFile=ChoFile`, `TrangThai=ChoLenLich`; đơn chuyển **Chờ chế bản**.
4. **`/che-ban` — Kanban chế bản**. 4 cột theo `TrangThaiFile`: Chờ file → Đang chế bản → Đã ra kẽm → Sẵn sàng. **Kéo-thả** (desktop) hoặc **dropdown** (mobile) để đổi trạng thái — cập nhật ngay (optimistic), ghi Sheets chạy nền, rollback nếu lỗi. Thẻ ở cột **Sẵn sàng** gắn nhãn *"Sẵn sàng xếp lịch"* (dùng lại ở Pha 2).

### ⚠️ Giá trị cấu hình CẦN PLANNER XÁC NHẬN — `lib/domain/config.ts`

Sửa số ở đây (không sửa code) khi có số thật của xưởng:

| Hằng số | Mặc định tạm | Ý nghĩa |
|---|---|---|
| `GIO_LAM_VIEC_MOI_NGAY` | `8` | Giờ làm việc/ngày (đổi `12` nếu tính tăng ca) |
| `DEM_CHE_BAN_NGAY` | `1` | Số ngày dự phòng cho chế bản/ra kẽm |
| `DEM_DONG_GOI_GIAO_GIO` | `4` | Số giờ dự phòng đóng gói + giao |
| `CONGDOAN_KHAC_MAKEREADY_PHUT` | `30` | Make-ready (phút) cho công đoạn không có máy chuyên (DongGhim/EpKim/Khac) |
| `CONGDOAN_KHAC_NANGSUAT` | `5000` | Năng suất giả định (tờ/giờ) cho công đoạn không có máy chuyên |
| `CONGDOAN_MAY` | map In→InOffset, CanMang→CanMang, Be→Be, Dan→Dan | Ánh xạ công đoạn → loại máy để lấy năng suất |

> Năng suất/make-ready của **công đoạn có máy chuyên** lấy từ **máy nhanh nhất đang hoạt động** trong tab `May` (chỉ sửa dữ liệu tab May, không sửa code).

**Công thức** (xem `lib/domain/estimate.ts`, `feasibility.ts`):
`thoiLuongPhut = makeReady + (SoLuong / NangSuat) × 60`; đơn khả thi khi `soNgayConLai ≥ soNgaySanXuat + đệm chế bản + đệm đóng gói`.

### Smoke test Pha 1 (chạy sau `npm run dev`, cần đăng nhập)

- [ ] `/don-hang/new`: nhập đơn, đặt hạn giao gấp → thấy **cảnh báo đỏ**; lưu → đơn **Mới**.
- [ ] `/don-hang`: lọc theo trạng thái/khách; mở được chi tiết.
- [ ] Chi tiết đơn: tạo **2 lệnh** cho cùng đơn (test 1→N), mỗi lệnh công đoạn riêng → đơn chuyển **Chờ chế bản**.
- [ ] `/che-ban`: kéo/đổi một lệnh sang **Sẵn sàng** → lưu đúng, thẻ có nhãn *"Sẵn sàng xếp lịch"*.
- [ ] Thử tạo lệnh với `MaDon` rác (qua API/hàm) → bị chặn với thông báo rõ ràng.

## H. Giả định Pha 1

1. **`DoUuTien` thuộc `LenhSanXuat`** (mô hình dữ liệu không có ở `DonHang`) → đặt ở form tạo lệnh, không ở form đơn. Form đơn cố định `TrangThai = Moi`.
2. **Công đoạn dự kiến** ở form tạo đơn chỉ dùng để *ước tính khả thi*, KHÔNG lưu vào `DonHang` (đơn chưa có cột công đoạn — đúng schema).
3. **Cảnh báo khả thi KHÔNG chặn lưu đơn** (theo yêu cầu — planner có thể vẫn nhận rồi thương lượng).
4. **`estimate`/`feasibility` là hàm thuần**, chạy được cả client: server suy "bảng năng lực máy" từ tab `May` rồi truyền xuống form → tính khả thi tức thời mà không gọi Sheets từ client.
5. **Ngày/giờ theo múi giờ VN** (`Asia/Ho_Chi_Minh`) qua `Intl`, độc lập với TZ server (Vercel = UTC). Vẫn lưu dạng chuỗi.
6. **`MaDon`/`MaLenh` đánh số theo năm** (`DH-2026-0001`, `LSX-2026-0001`), lấy max thứ tự trong năm hiện tại + 1; an toàn nhờ mô hình một người dùng.
7. **Audit tự động**: repo tự set `NguoiCapNhat` (email đăng nhập) + `NgayCapNhat` mỗi lần insert/update.
8. **Toàn vẹn tham chiếu**: tạo lệnh với `MaDon` không tồn tại → `RepositoryError`, không ghi (kiểm ở tầng repository, áp dụng cả từ UI).
9. **Kanban optimistic**: đổi ngay trên màn, ghi nền, rollback + báo lỗi nếu Sheets lỗi; không resync tức thời (một người dùng nên không lo lệch).
10. **Chưa có xóa** đơn/lệnh (BaseRepository không có `delete` ở giai đoạn này); chỉ tạo + cập nhật.
11. **Thêm file mới trong Pha 1** (đều thuần, không kéo `server-only`): `lib/domain/{config,datetime,id,inputs,labels,estimate,feasibility,gate}.ts`, `components/status-badge.tsx`, cùng các `page.tsx`/`actions.ts`/component client dưới `app/don-hang` và `app/che-ban`.
12. **Không làm ở Pha 1**: Planning Board/xếp lịch, tiến độ, phát sinh, báo cáo, optimistic locking, auto-scheduler, kho, đa người dùng — các route đó vẫn là placeholder.
