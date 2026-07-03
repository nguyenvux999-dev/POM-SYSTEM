# Kế hoạch Code — Hệ thống Quản lý Lệnh Sản xuất (In Offset)

> Bảng kế hoạch triển khai code, bám theo tài liệu `thiet-ke-he-thong-quan-ly-lenh-san-xuat.md`.
> Stack: **Next.js (App Router, TypeScript) + Vercel + Google Sheets** · Auth.js (Google OAuth, allowlist) · Service Account cho Sheets.

---

## 0. Quy ước & nguyên tắc xuyên suốt

| Nguyên tắc | Áp dụng |
|---|---|
| **Repository Pattern** | Toàn bộ app chỉ gọi `xxxRepository.method()`, KHÔNG gọi thẳng Sheets API. Đây là "bảo hiểm" để sau đổi sang Postgres. |
| **Cache toàn sheet ở server** | Đọc cả sheet 1 lần → giữ RAM → lọc/join trong code. Revalidate ngắn. |
| **Không gọi Sheets từ client** | Luôn qua Route Handler / Server Action (giấu service-account key). |
| **Append-only cho `TienDo`** | Trạng thái hiện tại = dòng mới nhất, tính ở tầng app. |
| **Mobile-first** | Luồng nhập nhanh + cập nhật tiến độ tối ưu điện thoại; Planning Board cho desktop. |
| **Optimistic UI** | Bấm xong hiện ngay, ghi Sheets chạy nền. |
| **2 cột hệ thống mỗi sheet** | `NguoiCapNhat`, `NgayCapNhat` (chưa cần `Version` ở MVP). |

**Đề xuất cấu trúc thư mục:**
```
/app
  /(auth)/login
  /don-hang            (Giai đoạn 1)
  /che-ban             (Giai đoạn 2 — Kanban)
  /xep-lich            (Giai đoạn 3 — Planning Board, desktop)
  /tien-do             (Giai đoạn 4 — mobile)
  /phat-sinh           (Giai đoạn 5)
  /bao-cao             (Giai đoạn 6)
  /api/...             (Route Handlers nếu cần)
/lib
  /sheets              (client Sheets + cache)
  /repositories        (donHang, lenhSanXuat, may, lichChay, tienDo, phatSinh, nguoiDung)
  /domain              (types, enums, công thức tính thời lượng, kiểm tra hạn giao)
  /auth                (Auth.js config + allowlist)
/components            (UI dùng chung: form, kanban, board, cảnh báo)
```

---

## PHA 0 — Nền tảng (bắt buộc trước, ~2–4 ngày)

| # | Task | Mô tả | File/Module | Phụ thuộc |
|---|---|---|---|---|
| 0.1 | Khởi tạo dự án | `create-next-app` (App Router, TS, Tailwind), ESLint/Prettier | root | — |
| 0.2 | Google Cloud setup | Tạo Service Account, tải JSON key, share Spreadsheet quyền Editor | (thủ công) | — |
| 0.3 | Biến môi trường | `GOOGLE_SERVICE_ACCOUNT_KEY`, `SPREADSHEET_ID`, `AUTH_*`, allowlist email | `.env.local`, `.env.example` | 0.2 |
| 0.4 | Sheets client + cache | Wrapper `googleapis`/`google-spreadsheet`, đọc-cache theo sheet, invalidate | `lib/sheets/*` | 0.3 |
| 0.5 | Base Repository | Lớp trừu tượng: `findAll/findById/insert/updateByKey/append`, map row↔object | `lib/repositories/base.ts` | 0.4 |
| 0.6 | Types & Enums | TS interface cho 7 thực thể + enum trạng thái (dịch từ mục 3) | `lib/domain/types.ts` | — |
| 0.7 | Auth.js + Google OAuth | Đăng nhập giới hạn allowlist email planner; middleware chặn route | `lib/auth/*`, `middleware.ts` | 0.1 |
| 0.8 | Khởi tạo sheet + seed | Tạo 8 sheet với header đúng; nạp **dữ liệu mẫu `May`** (mục 3.3) | script seed | 0.4 |
| 0.9 | Layout + điều hướng | Shell responsive, menu, trạng thái đăng nhập | `app/layout.tsx`, `components/nav` | 0.7 |

**Mốc P0:** Đăng nhập được, đọc/ghi thử 1 sheet qua repository, có seed máy.

---

## PHA 1 — Giai đoạn 1 & 2 (Tiếp nhận đơn + Chế bản, ~1–2 tuần)

| # | Task | Mô tả | File/Module | Phụ thuộc |
|---|---|---|---|---|
| 1.1 | Repo `DonHang` | CRUD + filter theo trạng thái/khách + sinh `MaDon` | `repositories/donHang.ts` | 0.5 |
| 1.2 | Repo `LenhSanXuat` | CRUD, sinh `MaLenh`, quan hệ FK→DonHang | `repositories/lenhSanXuat.ts` | 0.5 |
| 1.3 | Repo `NguoiDung` | Đọc vai trò (MVP: 1 dòng planner) | `repositories/nguoiDung.ts` | 0.5 |
| 1.4 | Công thức thời lượng | `MakeReady + (SoLuong/NangSuat)×60`; tổng theo công đoạn | `domain/estimate.ts` | 0.6 |
| 1.5 | Kiểm tra khả thi hạn giao | So `NgayGiaoHang - hôm nay` với (Σ công đoạn + đệm chế bản + đệm đóng gói); cảnh báo đỏ | `domain/feasibility.ts` | 1.4 |
| 1.6 | Form tạo đơn (mobile) | Form ngắn, chọn nhanh; gọi 1.5 khi nhập; ghi `DonHang` trạng thái `Moi` | `app/don-hang/new` | 1.1, 1.5 |
| 1.7 | Danh sách đơn | Bảng + filter (trạng thái, khách), link chi tiết | `app/don-hang` | 1.1 |
| 1.8 | Chi tiết đơn + tạo lệnh | Xem đơn; **mặc định 1 lệnh + nút "＋ Thêm lệnh"** (1→N); mỗi lệnh có `CongDoanCanLam` | `app/don-hang/[id]` | 1.2 |
| 1.9 | Kanban chế bản | Cột theo `TrangThaiFile`: `ChoFile→DangCheBan→DaRaKem→SanSang`; kéo/đổi trạng thái | `app/che-ban` | 1.2 |
| 1.10 | Gate `SanSang` | Chặn/cảnh báo nếu xếp lịch lệnh chưa `SanSang` (dùng lại ở Pha 2) | `domain/gate.ts` | 1.9 |
| 1.11 | Toàn vẹn tham chiếu | Không tạo lệnh với `MaDon` không tồn tại; validate ở repo | trong 1.2 | 1.1 |

**Mốc P1:** Nhập đơn + cảnh báo hạn giao + tách lệnh + theo dõi chế bản → *đã thay được việc nhập tay*.

---

## PHA 2 — Giai đoạn 3 & 4 (Planning Board + Tiến độ, ~2–3 tuần, KHÓ NHẤT)

| # | Task | Mô tả | File/Module | Phụ thuộc |
|---|---|---|---|---|
| 2.1 | Repo `May` | CRUD + chặn xóa máy đang có `LichChay` | `repositories/may.ts` | 0.5 |
| 2.2 | Repo `LichChay` | CRUD, sinh `MaLich`, FK→Lenh/May, thứ tự chạy | `repositories/lichChay.ts` | 0.5 |
| 2.3 | Danh sách "Lệnh chờ xếp" | Chỉ lệnh `SanSang`, sắp theo `HanHoanThanh` + `DoUuTien` | `app/xep-lich` (panel) | 1.10, 2.2 |
| 2.4 | Planning Board (desktop) | Cột = máy, hàng = timeline ngày/giờ; render `LichChay` | `app/xep-lich` | 2.1, 2.2 |
| 2.5 | Gán lệnh vào máy | Kéo/gán → tạo `LichChay`, **tự tính `BatDauDuKien/KetThucDuKien`** (2.1 + công thức) | trong 2.4 | 1.4, 2.4 |
| 2.6 | Trợ lý 1 — Cảnh báo trễ | Tô đỏ nếu `KetThucDuKien > HanHoanThanh` | `domain/assist.ts` | 2.5 |
| 2.7 | Trợ lý 2 — Gom màu/khổ | Đánh dấu lệnh cùng `SoMau`/`LoaiGiay`/`KhoThanhPham` để xếp liền, giảm make-ready | `domain/assist.ts` | 2.4 |
| 2.8 | Trợ lý 3 — Tải máy & luồng | Hiện % tải mỗi máy; cảnh báo dồn công đoạn sau (bế/dán) | `domain/assist.ts` | 2.5 |
| 2.9 | Chốt lịch → cập nhật trạng thái | Ghi `LichChay`; set `LenhSanXuat.TrangThai=DaLenLich` + `DonHang.TrangThai=DaLenLich` | trong 2.5 | 2.5 |
| 2.10 | Repo `TienDo` (append-only) | Chỉ `append`; hàm tính trạng thái hiện tại = dòng mới nhất | `repositories/tienDo.ts` | 0.5 |
| 2.11 | Phát lệnh / DS đang chạy | Từ lịch đã chốt, danh sách lệnh đang chạy | `app/tien-do` | 2.9 |
| 2.12 | Cập nhật tiến độ 3 chạm (mobile) | Chọn lệnh → chọn công đoạn → nhập SL đạt → ghi `TienDo`; nút to, ít gõ | `app/tien-do/[id]` | 2.10 |
| 2.13 | Dashboard tiến độ | Tổng hợp trạng thái theo dòng `TienDo` mới nhất | `app/tien-do` | 2.10 |

**Mốc P2:** Xếp lịch trực quan + 3 trợ lý quyết định + phát lệnh + cập nhật tiến độ qua điện thoại → *lõi hệ thống*.

---

## PHA 3 — Giai đoạn 5 (Phát sinh & sắp xếp lại, ~1 tuần)

| # | Task | Mô tả | File/Module | Phụ thuộc |
|---|---|---|---|---|
| 3.1 | Repo `PhatSinh` | CRUD, sinh `MaPhatSinh`, FK→Lenh | `repositories/phatSinh.ts` | 0.5 |
| 3.2 | Form ghi phát sinh (mobile) | Loại/Mức độ/AnhHuongTienDo/Hướng xử lý | `app/phat-sinh/new` | 3.1 |
| 3.3 | Logic ảnh hưởng | Nếu `AnhHuongTienDo=true`: đánh dấu `LichChay` liên quan cần xếp lại | `domain/reschedule.ts` | 2.2, 3.1 |
| 3.4 | Đưa lệnh về hàng chờ | Trả lệnh về danh sách "chờ xếp" của Planning Board | trong 3.3 | 2.3, 3.3 |
| 3.5 | Cảnh báo đơn nguy cơ trễ | Liệt kê mọi lệnh trên máy hỏng + đơn deadline sát | `domain/reschedule.ts` | 3.3 |
| 3.6 | Bảng "Cần xử lý" | Danh sách phát sinh + nút "xếp lại" → về Giai đoạn 3 | `app/phat-sinh` | 3.3 |

**Mốc P3:** Ghi sự cố → hệ thống tự chỉ ra lệnh/đơn bị ảnh hưởng → xếp lại nhanh.

---

## PHA 4 — Giai đoạn 6 (Báo cáo & vận hành, ~1 tuần)

| # | Task | Mô tả | File/Module | Phụ thuộc |
|---|---|---|---|---|
| 4.1 | Báo cáo ngày | Đơn xong / đang chạy / nguy cơ trễ (+ lý do từ `PhatSinh`) | `app/bao-cao/ngay` | 2.13, 3.1 |
| 4.2 | Tải máy theo tuần | % sử dụng từng máy → phát hiện nút thắt | `app/bao-cao/tai-may` | 2.2 |
| 4.3 | Tỷ lệ đúng hạn | % đơn giao đúng hạn theo tháng | `app/bao-cao/dung-han` | 1.1, 2.13 |
| 4.4 | Thống kê phát sinh | Loại sự cố hay gặp nhất | `app/bao-cao/phat-sinh` | 3.1 |
| 4.5 | Filter khoảng ngày | Bộ lọc chung cho các báo cáo | `components/date-range` | 4.1 |
| 4.6 | Xuất Excel/PDF | Nút xuất để gửi quản lý | `lib/export/*` | 4.1–4.4 |
| 4.7 | Archive theo tháng | Chuyển đơn/lệnh `HoanThanh` sang `Archive_YYYY_MM` | script/route | 1.1, 1.2 |

**Mốc P4:** Báo cáo realtime + xuất file + sheet chính luôn nhẹ.

---

## Việc cần chốt với nghiệp vụ (chặn công thức chạy đúng)

| Hạng mục | Cần ai cung cấp | Ảnh hưởng task |
|---|---|---|
| Số thật `May` (năng suất tờ/giờ, make-ready) | Xưởng | 1.4, 2.5 (chỉ sửa data, không sửa code) |
| Giá trị "đệm": ngày chế bản, giờ đóng gói/giao | Planner | 1.5 |
| Danh sách công đoạn chuẩn (`In`,`CanMang`,`Be`,`Dan`,`EpKim`…) → enum `CongDoan` | Xưởng | 0.6, 1.8 |
| Email allowlist planner | Bạn | 0.7 |

---

## Thứ tự khuyến nghị & ước lượng tổng

```
PHA 0 (nền tảng)  →  PHA 1 (đơn+chế bản)  →  PHA 2 (xếp lịch+tiến độ)  →  PHA 3 (phát sinh)  →  PHA 4 (báo cáo)
   ~3 ngày              ~1.5 tuần                ~2.5 tuần                    ~1 tuần            ~1 tuần
```
Sau **mỗi pha đều có phần dùng được ngay**. Ưu tiên đầu tư vào PHA 2 (lõi giá trị).

**Không làm ở MVP:** auto-scheduler, optimistic locking, tích hợp kho, đa người dùng (đã chừa khung `NguoiDung` + `Version` để bật sau).
