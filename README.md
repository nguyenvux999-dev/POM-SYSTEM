# Quản lý Lệnh Sản xuất (In Offset) — MVP hoàn chỉnh (Pha 0–4)

Hệ thống hỗ trợ planner sắp xếp lệnh sản xuất cho xưởng in offset nhỏ.
**Đã hoàn thành đủ 6 giai đoạn nghiệp vụ** (xem bảng tổng kết ở mục N cuối file):
Tiếp nhận đơn → Chế bản → Xếp lịch (Planning Board) → Tiến độ → Phát sinh & xếp lại → Báo cáo & archive.
Nền tảng: Auth, tầng truy cập dữ liệu (Repository), cache, seed và khung điều hướng.

> Hướng dẫn theo pha: **A–F** nền tảng (Pha 0) · **G–H** Pha 1 · **I–J** Pha 2 · **K–L** Pha 3 · **M–N** Pha 4.

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

**Trường sản xuất bổ sung ở `LenhSanXuat`** (thêm vào CUỐI header — dòng dữ liệu cũ để trống vẫn đọc bình thường; `SoMau`/`LoaiGiay` KHÔNG lặp vì đã có ở `DonHang`, đọc qua join):

| Cột mới | Kiểu | Ý nghĩa |
|---|---|---|
| `MaLSXXuong` | text (tùy chọn) | Mã lệnh theo định dạng xưởng, vd `OS-25SL3101-30062026-3`. Bỏ trống → dùng `MaLenh` hệ thống. Hiển thị làm **mã chính**, kèm `MaLenh` nhỏ màu xám. |
| `SoTrang` | number (tùy chọn) | Số trang (sản phẩm sách); 0/trống = không áp dụng. |
| `KhoGiay` | text | Khổ giấy, vd `700x965mm`. |
| `KhoIn` | text | Khổ in, vd `700x475mm`. |
| `BuHaoPhanTram` | number | % bù hao; trống/0 → dùng `BU_HAO_MAC_DINH_PHAN_TRAM`. |

> `npm run seed` sẽ **tự thêm các cột còn thiếu** vào cuối header của tab đang có (idempotent, không mất dữ liệu). Chạy lại seed sau khi cập nhật mã.

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
| `BU_HAO_MAC_DINH_PHAN_TRAM` | `3` | % bù hao mặc định khi lệnh **không** nhập `BuHaoPhanTram` riêng — cộng vào số lượng khi tính thời lượng ở mọi nơi (ước tính, khả thi, xếp lịch, xếp lại) |

> Năng suất/make-ready của **công đoạn có máy chuyên** lấy từ **máy nhanh nhất đang hoạt động** trong tab `May` (chỉ sửa dữ liệu tab May, không sửa code).

**Công thức** (xem `lib/domain/estimate.ts`, `feasibility.ts`):
`SoLuongCanIn = SoLuong × (1 + BuHaoPhanTram/100)` (bù hao lấy từ lệnh, trống/0 → `BU_HAO_MAC_DINH_PHAN_TRAM`);
`thoiLuongPhut = makeReady + (SoLuongCanIn / NangSuat) × 60`; đơn khả thi khi `soNgayConLai ≥ soNgaySanXuat + đệm chế bản + đệm đóng gói`.

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

## I. Pha 2 — Xếp lịch & Tiến độ (cách dùng)

Hiện thực **Giai đoạn 3 (Planning Board, desktop)** và **Giai đoạn 4 (Tiến độ, mobile)**.

Luồng nghiệp vụ:

1. **`/xep-lich` — Bảng xếp lịch** (tối ưu desktop, vẫn xem được trên mobile).
   - **Panel "Lệnh chờ xếp"**: chỉ lệnh đã **Sẵn sàng** (`TrangThaiFile=SanSang`) và **Chờ lên lịch**, sắp theo **hạn** rồi **độ ưu tiên** (Gấp > Cao > Bình thường > Thấp). Mỗi thẻ báo trước **dự kiến trễ** nếu xếp bây giờ.
   - **Xếp lệnh**: bấm **"Xếp lịch"** (tự chọn máy nhanh nhất mỗi công đoạn) hoặc **kéo-thả** thẻ vào cột máy (ép công đoạn khớp loại máy vào máy đó). Hệ thống tự tính `BatDauDuKien/KetThucDuKien` tuần tự các công đoạn, **không đè** job khác trên cùng máy, rồi chốt: lệnh → **Đã lên lịch**, đơn → **Đã lên lịch** (khi mọi lệnh của đơn đã xếp).
   - **Board theo máy/ngày**: cột = máy, chọn ngày xem (◀ ▶ / hôm nay). Mỗi khối hiện mã lệnh, công đoạn, khung giờ, thứ tự.
   - **3 trợ lý quyết định**: (1) tô **đỏ** lệnh `KetThuc > HanHoanThanh`; (2) **viền màu** nhận diện lệnh cùng số màu/khổ/giấy để xếp liền giảm make-ready; (3) **% tải** mỗi máy trong ngày + cảnh báo **dồn** ở công đoạn sau (Bế/Dán).
   - **Lệnh đã xếp**: đổi máy từng công đoạn hoặc dời **mốc bắt đầu** rồi bấm **"Tính lại lịch"** (cập nhật tại chỗ, tính lại các công đoạn sau).
2. **`/tien-do` — Dashboard & danh sách đang chạy** (mobile-first). Các lệnh **Đã lên lịch / Đang chạy**, kèm % hoàn thành theo công đoạn, công đoạn hiện tại, cờ **nguy cơ trễ**. Chạm một lệnh để mở màn cập nhật.
3. **`/tien-do/[MaLenh]` — Cập nhật 3 chạm**: chọn **công đoạn** → chọn **trạng thái** (Bắt đầu chạy / Xong) → nhập **số lượng đạt** (nút "Đủ …") → **Lưu**. Mỗi lần lưu **append** một dòng `TienDo` và tự chuyển trạng thái: bắt đầu → `LichChay=DangChay`, `Lệnh=DangChay`, `Đơn=DangSanXuat`; xong hết công đoạn → `Lệnh=HoanThanh` (đơn `HoanThanh` khi mọi lệnh xong).

### ⚠️ Giá trị cấu hình MỚI CẦN PLANNER XÁC NHẬN — `lib/domain/config.ts`

| Hằng số | Mặc định tạm | Ý nghĩa |
|---|---|---|
| `GIO_BAT_DAU_LAM` | `"08:00"` | Giờ vào ca mỗi ngày (cửa sổ làm việc = `[GIO_BAT_DAU_LAM, +GIO_LAM_VIEC_MOI_NGAY giờ]`) |
| `NGAY_NGHI` | `[]` | Ngày nghỉ cố định trong tuần (0=CN…6=T7); `[]` = chạy cả tuần. Vd nghỉ CN: `[0]` |
| `GIO_LAM_VIEC_MOI_NGAY` | `8` | (đã có ở Pha 1) **xác nhận lại** — số giờ làm/ngày dùng để tính giãn lịch |

> Năng suất/make-ready từng máy vẫn lấy từ tab `May` (chỉ sửa dữ liệu, không sửa code).

### Giả định & giới hạn của mô hình xếp lịch (đã biết)

- **Mỗi công đoạn chạy trên đúng 1 máy**; các công đoạn của một lệnh **phụ thuộc tuần tự** theo thứ tự `CongDoanCanLam` (In → Cán → Bế → Dán…).
- **Chưa xét chia mẻ song song** (không tách một lệnh chạy song song trên nhiều máy).
- Công đoạn **không có máy chuyên** (Đóng ghim/Ép kim/Khác) được ước tính thời lượng bằng `CONGDOAN_KHAC_*` nhưng **không gắn máy** (không chiếm cột máy nào trên board).
- **Ngày/giờ tính theo wall-clock VN** lưu như UTC nội bộ (không chuyển múi giờ) → không lệch ngày dù server chạy UTC (Vercel). Vẫn lưu Sheets dạng chuỗi `YYYY-MM-DD HH:mm`.
- **`ThuTu`** là ảnh chụp thứ hạng theo `BatDauDuKien` lúc ghi; board/danh sách luôn hiển thị theo thời gian nên `ThuTu` chỉ để tham khảo.
- Vẫn **không có optimistic locking / auto-scheduler** (đúng phạm vi một-người-dùng, công cụ hỗ trợ quyết định).

### Smoke test Pha 2 (sau `npm run dev`, cần đăng nhập; cần vài lệnh **Sẵn sàng** từ Pha 1)

- [ ] Có ≥2 lệnh `SanSang` → `/xep-lich` panel "Lệnh chờ xếp" hiện đúng thứ tự hạn/ưu tiên.
- [ ] Xếp một lệnh nhiều công đoạn (vd `In;CanMang;Be`) → sinh các `LichChay` giờ **tuần tự**, không đè job khác; board hiện đúng máy/thời gian.
- [ ] Đặt hạn sát để xếp bị vượt → thấy **cảnh báo đỏ**; hai lệnh cùng khổ/màu → thấy **viền gom**.
- [ ] Sau khi xếp → lệnh **Đã lên lịch**, đơn **Đã lên lịch**.
- [ ] Trên điện thoại `/tien-do/[MaLenh]`: cập nhật "In → Xong (đủ số lượng)" → `TienDo` được append, dashboard đổi trạng thái; xong hết công đoạn → lệnh **Hoàn thành**.

## J. Giả định Pha 2

1. **Repo `May/LichChay/TienDo` nâng cấp thành class** (giữ singleton export): `May` thêm CRUD + `xoa` chặn khi còn `LichChay` tham chiếu + `findByLoai/nhanhNhatTheoLoai`; `LichChay` sinh `MaLich=LC-NNN`, validate FK + **gate SanSang**, `findByMay/Lenh/InRange`, `capNhatThuTuMay`; `TienDo` (vẫn append-only) thêm `findByLenh/generateMaLog(TD-NNN)/trangThaiHienTai`.
2. **`BaseRepository` thêm `deleteByKey`** (batchUpdate `deleteDimension`, cần `getSheetId` trong `lib/sheets/client.ts`). `TienDo` **không** expose delete.
3. **Xếp lịch = chốt lịch luôn** (2.5 + 2.9 gộp): tạo `LichChay` đồng thời đặt lệnh/đơn `DaLenLich`. "Xếp lại" cập nhật các dòng `LichChay` **tại chỗ** (không xóa/tạo lại) nên không cần `delete` ở luồng thường.
4. **`estimate.ts` (Pha 1) và `schedule.ts` (Pha 2) tách vai trò**: `estimate` chỉ ước lượng tổng thời lượng cho kiểm tra khả thi; `schedule` mới là nơi giãn lịch theo giờ làm việc + mốc rảnh máy. `schedule.ts`/`assist.ts` là **hàm thuần**, chạy được cả client (board xem trước dự kiến trễ mà không gọi Sheets).
5. **Optimistic UI**: bấm "Xếp lịch" ẩn thẻ khỏi panel chờ ngay, ghi nền, lỗi thì khôi phục + báo; sau thành công `router.refresh()` để đồng bộ.
6. **Thêm file mới Pha 2**: `lib/domain/{schedule,assist}.ts`; mở rộng `lib/domain/{config,datetime,labels}.ts`, `components/status-badge.tsx`, `lib/repositories/{base,may,lichChay,tienDo}.ts`, `lib/sheets/client.ts`; các `page.tsx`/`actions.ts`/component client dưới `app/xep-lich` và `app/tien-do`.
7. **Không làm ở Pha 2**: phát sinh & sắp-xếp-lại (Giai đoạn 5), báo cáo (Giai đoạn 6), auto-scheduler tối ưu, optimistic locking, kho, đa người dùng — `/phat-sinh`, `/bao-cao` vẫn placeholder.

## K. Pha 3 — Phát sinh & sắp xếp lại (cách dùng)

Hiện thực **Giai đoạn 5**: ghi sự cố → hệ thống tự chỉ ra lệnh/đơn bị ảnh hưởng → xếp lại nhanh (chỉ công đoạn chưa xong).

Luồng nghiệp vụ:

1. **`/phat-sinh/new` — Ghi phát sinh** (mobile-first; mở nhanh từ `/tien-do/[MaLenh]` qua nút *"⚠️ Ghi phát sinh"*, tự điền sẵn lệnh). Chọn **lệnh liên quan**, **loại** (Máy hỏng/Giấy trễ/Lệch màu/Đổi số lượng/Đơn gấp/Khác), **mức độ**, **ảnh hưởng tiến độ?** (Có/Không), mô tả, hướng xử lý. Nếu **Máy hỏng** → chọn máy + đặt `May.TrangThai` = Bảo trì/Hỏng. Lưu → `TrangThai=Mới`, `ThoiGian=bây giờ`.
2. **`/phat-sinh` — Bảng "Cần xử lý"** gồm 4 khu vực:
   - **Nguy cơ trễ**: mọi lệnh có công đoạn chưa xong nằm trên máy đang không hoạt động, kèm khách/hạn/**dự báo ngày xong mới**, sắp theo hạn gần nhất — "danh sách tác động tức thì".
   - **Lệnh cần xếp lại** (suy ra động): mỗi lệnh hiển thị lý do (máy lỗi / phát sinh ảnh hưởng), **công đoạn đã Xong được giữ**, các công đoạn còn lại kèm **chọn máy (chỉ máy đang hoạt động)** + mốc bắt đầu; bấm **"Xếp lại"** → thay lịch chưa xong bằng lịch mới.
   - **Trạng thái máy**: đổi nhanh Hoạt động/Bảo trì/Hỏng (dùng để **khôi phục** máy về Hoạt động sau sự cố).
   - **Danh sách phát sinh**: lọc theo trạng thái/mức độ; đổi `Mới → Đang xử lý → Đã xong`.

### ⚠️ Giá trị cấu hình MỚI CẦN PLANNER XÁC NHẬN — `lib/domain/config.ts`

| Hằng số | Mặc định tạm | Ý nghĩa |
|---|---|---|
| `DE_DOA_TRE_NGAY` | `2` | Đơn/lệnh có hạn trong vòng N ngày kể từ hôm nay → coi là "nguy cơ trễ" khi có sự cố |

### Smoke test Pha 3 (sau `npm run dev`, cần đăng nhập; cần vài lệnh đã xếp lịch từ Pha 2)

- [ ] Ghi phát sinh `LechMau`, **Ảnh hưởng = Không** cho một lệnh → lưu OK, lệnh **KHÔNG** xuất hiện trong "Cần xếp lại".
- [ ] Đặt `M03 = Hỏng` (hoặc ghi phát sinh `MayHong` chọn M03) → `/phat-sinh` liệt kê mọi lệnh còn dở trên M03 trong "Cần xếp lại" + bảng nguy cơ trễ.
- [ ] Lệnh đã **In Xong** nhưng công đoạn sau kẹt máy hỏng → **"Xếp lại"** → chỉ công đoạn chưa xong chuyển sang máy Hoạt động khác, giờ tính lại tuần tự sau mốc In đã xong; **In giữ nguyên Xong**.
- [ ] Đóng phát sinh (**Đã xong**) + đưa máy **về Hoạt động** → lệnh không còn trong "Cần xếp lại".

## L. Giả định Pha 3

1. **"Cần xếp lại" là trạng thái SUY RA động** (`lib/domain/reschedule.ts`), KHÔNG thêm giá trị enum `LenhSanXuat.TrangThai` và không lưu cột riêng. Điều kiện: (a) có `PhatSinh` `AnhHuongTienDo=TRUE` chưa `DaXong`, HOẶC (b) có `LichChay` chưa Xong nằm trên máy `May.TrangThai != HoatDong`.
2. **Sự cố hỏng máy thể hiện qua `May.TrangThai`** (Bảo trì/Hỏng) — `PhatSinh` không có cột máy. Logic ảnh hưởng đọc `May.TrangThai` để tìm lệnh bị kẹt.
3. **Chỉ xét lệnh đã có lịch & chưa Hoàn thành** cho "cần xếp lại" (lệnh chưa xếp thuộc luồng `/xep-lich` bình thường).
4. **Xếp lại KHÔNG đụng công đoạn đã Xong**: `tinhLaiLichConLai` giữ nguyên dòng `Xong`, chỉ tính lại công đoạn chưa xong, bắt đầu sau mốc kết thúc của công đoạn Xong cuối cùng, **chỉ chọn máy đang HoatDong** (tái dùng `tinhLichChoLenh` của Pha 2).
5. **Cơ chế thay lịch**: `xepLaiSuCo` **xóa** các `LichChay` chưa Xong (dùng `deleteByKey` của Pha 2) rồi **tạo** dòng mới — không transaction (đúng phạm vi một-người-dùng; nếu lỗi giữa chừng, planner chạy lại). Trạng thái lệnh/đơn không đổi khi xếp lại (chỉ dời công đoạn).
6. **Giới hạn đã biết**: nếu loại công đoạn chỉ có **một** máy chuyên và máy đó hỏng, xếp lại sẽ để công đoạn ở trạng thái **không có máy** (`MaMay=""`) cho tới khi có máy hoạt động cùng loại — planner cần thêm/khôi phục máy. Dự báo "nguy cơ trễ" là thử nghiệm độc lập từng lệnh (không mô phỏng tranh chấp máy giữa nhiều lệnh cùng lúc).
7. **Thêm file mới Pha 3**: `lib/domain/reschedule.ts`; mở rộng `lib/domain/{config,labels,inputs}.ts`, `components/status-badge.tsx`, `lib/repositories/phatSinh.ts`; các `page.tsx`/`actions.ts`/component client dưới `app/phat-sinh`.
8. **Không làm ở Pha 3**: báo cáo (Giai đoạn 6), archive, optimistic locking, auto-scheduler, kho, đa người dùng — `/bao-cao` vẫn placeholder.

## M. Pha 4 — Báo cáo & vận hành (cách dùng) · *hoàn tất MVP*

Hiện thực **Giai đoạn 6**: mọi số liệu **suy ra realtime** từ các sheet (không lưu bảng báo cáo).

`/bao-cao` là bảng điều hướng tới 4 báo cáo; mỗi báo cáo có **bộ lọc khoảng ngày dùng chung** (`components/date-range.tsx`, preset nhanh) và nút **Xuất Excel** (SheetJS, tải động) + **In / PDF** (`window.print()` + print stylesheet).

1. **`/bao-cao/ngay` — Báo cáo ngày**: 3 nhóm cho ngày chọn — *đã xong* (lệnh/đơn có mốc hoàn thành suy từ `TienDo` rơi vào ngày) · *đang chạy* · *nguy cơ trễ* (máy hỏng — Pha 3, hoặc lịch vượt hạn — Pha 2) kèm **lý do** = phát sinh đang mở.
2. **`/bao-cao/tai-may` — Tải máy tuần**: % tải mỗi máy = Σ phút bận (theo giờ làm việc) / phút khả dụng; **đánh dấu máy nghẽn** (≥ `NGUONG_NGHEN_MAY`).
3. **`/bao-cao/dung-han` — Tỷ lệ đúng hạn tháng**: đơn hoàn thành trong tháng, đúng hạn nếu ngày hoàn thành ≤ `NgayGiaoHang`; đơn `TreHen` tính là trễ. Kèm danh sách đơn trễ + số ngày trễ.
4. **`/bao-cao/phat-sinh` — Thống kê phát sinh**: xếp hạng loại sự cố hay gặp + phân bố mức độ + % ảnh hưởng tiến độ.

**Mốc hoàn thành suy từ `TienDo`**: xong một công đoạn = `ThoiGian` của dòng `TienDo` mới nhất có `TrangThaiMoi="Xong"`; xong cả lệnh/đơn = khi mọi công đoạn/mọi lệnh đều có mốc Xong (lấy max).

### ⚠️ Giá trị cấu hình MỚI CẦN PLANNER XÁC NHẬN — `lib/domain/config.ts`

| Hằng số | Mặc định tạm | Ý nghĩa |
|---|---|---|
| `NGUONG_NGHEN_MAY` | `0.85` | Ngưỡng % tải để coi một máy là "nghẽn/cổ chai" |
| `ARCHIVE_SAU_NGAY` | `30` | Chỉ archive đơn `HoanThanh` có ngày hoàn thành cũ hơn N ngày |

### 4.7 — Archive theo tháng (`npm run archive`)

Chuyển đơn `HoanThanh` **cũ** (mọi lệnh đã xong + hoàn thành cũ hơn `ARCHIVE_SAU_NGAY` ngày) sang các tab `Archive_YYYY_MM_<Entity>`, rồi xóa khỏi tab chính để sheet luôn nhẹ.

```bash
npm run archive             # DRY-RUN: chỉ liệt kê đơn đủ điều kiện, KHÔNG ghi/xóa
npm run archive -- --apply  # CHẠY THẬT
```

> 🔒 **TRƯỚC KHI CHẠY THẬT**: bật **Lịch sử phiên bản** Google Sheets (File → Version history) và **export sao lưu** (File → Download → .xlsx). Archive có xóa dòng ở tab chính.

An toàn: ghi archive **trước** (dedup theo khóa chính → idempotent), chỉ **xóa** dòng tab chính **sau khi** mọi lần ghi thành công; chạy lại không nhân đôi.

### Smoke test Pha 4

- [ ] `/bao-cao` → mở được 4 báo cáo; đổi khoảng ngày (preset) → số liệu cập nhật.
- [ ] Báo cáo ngày (ngày có dữ liệu) hiển thị đúng 3 nhóm + lý do nguy cơ trễ.
- [ ] Tải máy tuần chỉ ra máy nghẽn; đúng hạn tháng tính đúng %; thống kê phát sinh đếm đúng.
- [ ] Bấm **Xuất Excel** → tải file `.xlsx` mở đúng nội dung; **In / PDF** → bản in gọn (ẩn nav/nút).
- [ ] `npm run archive` (dry-run) liệt kê đúng đơn đủ điều kiện; `-- --apply` → chuyển sang `Archive_YYYY_MM_*`, tab chính bớt dòng, dữ liệu đang hoạt động không đổi.

## N. Giả định Pha 4 & Tổng kết MVP

**Giả định Pha 4:**
1. **Báo cáo chỉ ĐỌC, suy ra realtime** (`lib/domain/report.ts` — hàm thuần); ngoại lệ ghi duy nhất là archive.
2. **Tái sử dụng** `assist.tinhTaiMay` (tải máy), `reschedule.danhSachNguyCoTre` (máy hỏng), `assist.treHan` (lịch vượt hạn) — không viết lại logic.
3. **Bộ lọc dùng chung** đẩy `from`/`to` lên URL (searchParams) → server component render lại; hỗ trợ mode `day`/`week`/`month`/`range`.
4. **Xuất Excel bằng SheetJS** import ĐỘNG (chỉ tải khi bấm) → không phình bundle. Chỉ GHI file từ dữ liệu client (không parse file ngoài) nên các advisory của `xlsx` không áp dụng. **PDF** = in trình duyệt + print CSS (không thêm thư viện nặng).
5. **Archive per-entity-per-month** (`Archive_{YYYY_MM}_{Entity}`) để giữ đúng header từng thực thể; dùng `deleteDimension` xóa từ dưới lên; không transaction (đúng phạm vi một-người-dùng).
6. **Thêm file mới Pha 4**: `lib/domain/report.ts`, `lib/export/excel.ts`, `components/{date-range,export-button}.tsx`, `scripts/archive.ts`, các trang dưới `app/bao-cao/*`; mở rộng `lib/domain/{config,datetime}.ts`, `app/globals.css` (print), `package.json` (script `archive` + dep `xlsx`).

**✅ Tổng kết — MVP hoàn chỉnh 6 giai đoạn:**

| Pha | Giai đoạn | Trạng thái |
|---|---|---|
| 0 | Nền tảng (Auth, Repository, cache, seed) | ✅ |
| 1 | Tiếp nhận đơn + Chế bản | ✅ |
| 2 | Planning Board + Tiến độ | ✅ |
| 3 | Phát sinh & sắp xếp lại | ✅ |
| 4 | Báo cáo & archive | ✅ |

**Hướng mở rộng tiếp theo (ngoài MVP, đã chừa khung sẵn):** auto-scheduler tối ưu; optimistic locking (thêm cột `Version`, kiểm trước khi ghi — đã chừa trong repository); tích hợp kho (giấy/mực); **đa người dùng/phân quyền** (đã có khung `NguoiDung` + cột `VaiTro`). Khi mở nhiều người cùng ghi → cân nhắc chuyển **Postgres (Supabase/Neon)**: nhờ Repository Pattern chỉ viết lại lớp trong `lib/repositories/*`, phần còn lại của app gần như không đổi.
