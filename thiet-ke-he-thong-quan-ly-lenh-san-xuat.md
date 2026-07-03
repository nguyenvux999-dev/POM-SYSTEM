# Thiết kế hệ thống Quản lý Sắp xếp Lệnh Sản xuất (In Offset)
### Next.js + Vercel + Google Sheets — bản phân tích & thiết kế cho công ty quy mô nhỏ

*Tài liệu này phân tích toàn bộ quy trình 6 giai đoạn, đề xuất mô hình dữ liệu, kiến trúc, và lộ trình build.*

---

## 0. Giả định & phạm vi

Thiết kế đã chốt theo các ràng buộc thực tế bạn xác nhận:

- **Người dùng: hiện chỉ MỘT — planner.** Kinh doanh, Chế bản, Tổ trưởng, Quản lý *không* trực tiếp dùng hệ thống; họ đưa dữ liệu qua các kênh khác (Zalo, giấy, miệng…), planner là người nhập tất cả vào. → **Không có ghi đồng thời** → rủi ro ghi đè gần như bằng 0 → Google Sheets là lựa chọn *phù hợp thật sự*, không chỉ "tạm được".
- **Thiết bị: ưu tiên điện thoại cho cập nhật.** Planner cập nhật tiến độ qua điện thoại (thường khi đi quanh xưởng). → App phải **mobile-first ở các luồng nhập nhanh & cập nhật tiến độ**; riêng Bảng xếp lịch (thao tác phức tạp) làm cho desktop nhưng vẫn xem được trên mobile.
- **Một đơn hàng → nhiều lệnh in (tùy chọn).** Mô hình dữ liệu hỗ trợ 1→N; giao diện *mặc định tạo 1 lệnh* cho nhanh, có nút "＋ Thêm lệnh" khi cần tách.
- **Chưa tích hợp kho** (giấy/mực) — để ngoài phạm vi giai đoạn này.
- **Khối lượng:** vài chục đến ~100 lệnh đang chạy tại một thời điểm.
- **Không auto-optimize lịch chạy máy.** Hệ thống là **công cụ hỗ trợ ra quyết định** cho planner, không phải bộ giải tối ưu tự động.
- **Đăng nhập:** Google OAuth giới hạn đúng email của planner (đơn giản, an toàn, và mở đường cho đa người dùng sau này).

> **Giới hạn thật cần ý thức:** vì mọi thứ dồn qua planner nhập tay, *planner là nút cổ chai* — đây (chứ không phải công nghệ) mới là ngưỡng khi công ty lớn lên. Thiết kế vẫn giữ sẵn cột `VaiTro` + khung phân quyền, để sau này mở tài khoản cho các bộ phận khác chỉ là "bật lên", không phải build lại.

---

## 1. Đánh giá lựa chọn công nghệ (góc nhìn kiến trúc)

### Điểm mạnh của Next.js + Vercel + Google Sheets ở quy mô nhỏ
- **Chi phí ~0đ:** Vercel Hobby/Pro rẻ, Google Sheets miễn phí.
- **Nhân viên quen Sheets:** khi hệ thống lỗi, vẫn mở Sheet xem/sửa tay được — cực kỳ giá trị cho xưởng nhỏ.
- **Backup/export dễ**, không cần DBA.
- **Build nhanh:** Next.js Route Handlers/Server Actions gọi Sheets API là xong.

### Rủi ro cốt lõi — và vì sao phần lớn đã được hóa giải bởi mô hình một-người-dùng
| Rủi ro | Còn đáng lo không? | Xử lý |
|---|---|---|
| **Không có row locking / transaction** | **Gần như KHÔNG** — chỉ 1 người (planner) ghi, không có sửa đồng thời | Bỏ optimistic locking ở MVP. Vẫn giữ cột `NgayCapNhat` để truy vết. *(Bật lại locking khi mở đa người dùng.)* |
| **Giới hạn API quota** (~60 req/phút/người) | Thấp, vì 1 người dùng | **Cache tại server** (đọc cả sheet 1 lần, lọc trong RAM) là quá đủ. |
| **Không có index, quét tuyến tính** | Chậm dần khi dữ liệu phình | Tách sheet "đang chạy" và "lưu trữ" (archive) theo tháng/quý. |
| **Latency mỗi call ~200–800ms** | Có thể cảm nhận trên mobile | Server-side cache + revalidate ngắn; nhập nhanh, phản hồi lạc quan (optimistic UI) ở client. |

Kết luận: với mô hình một người dùng, **Google Sheets là lựa chọn phù hợp** cho toàn bộ vòng đời MVP và có thể còn xa hơn.

### Nguyên tắc kiến trúc quan trọng nhất
> **Tách lớp truy cập dữ liệu (Repository Pattern).** Toàn bộ code app chỉ gọi `orderRepository.findById()`, `scheduleRepository.save()`… — **không** gọi thẳng Google Sheets API rải rác. Khi cần lên Postgres, chỉ viết lại phần bên trong repository, phần còn lại của app không đổi. Đây là "bảo hiểm" quan trọng nhất của bạn.

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                    NGƯỜI DÙNG: PLANNER                     │
│   📱 Điện thoại (nhập nhanh + cập nhật tiến độ ngoài xưởng) │
│   💻 Desktop (Bảng xếp lịch + báo cáo)                     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│                    NEXT.JS trên VERCEL                     │
│  ┌───────────────┐   ┌──────────────────────────────┐    │
│  │  UI (React)   │   │  Auth.js — Google OAuth        │    │
│  │  Mobile-first │   │  giới hạn 1 email planner      │    │
│  └───────┬───────┘   └──────────────────────────────┘    │
│          │                                                │
│  ┌───────▼──────────────────────────────────────────┐    │
│  │  Route Handlers / Server Actions                  │    │
│  │  (logic: kiểm tra hạn giao, xếp lịch, báo cáo)    │    │
│  └───────┬───────────────────────────────────────────┘   │
│          │                                                │
│  ┌───────▼───────┐   ┌──────────────────────────┐        │
│  │ Repository    │   │  Cache (server memory)    │        │
│  │ Layer (abstr.)│◄──┤                           │        │
│  └───────┬───────┘   └──────────────────────────┘        │
└──────────┼───────────────────────────────────────────────┘
           │ Google Sheets API (Service Account)
┌──────────▼───────────────────────────────────────────────┐
│                     GOOGLE SHEETS (DB)                     │
│  DonHang · LenhSanXuat · May · LichChay · TienDo ·         │
│  PhatSinh · NguoiDung · (Archive_YYYY_MM)                  │
└───────────────────────────────────────────────────────────┘
```

**Xác thực Sheets:** dùng **Service Account** (không dùng OAuth của user để ghi DB). Tạo service account trên Google Cloud, tải file JSON key, chia sẻ (share) spreadsheet cho email service account với quyền Editor. Key lưu trong biến môi trường Vercel (`GOOGLE_SERVICE_ACCOUNT_KEY`).

**Thư viện gợi ý:** `google-spreadsheet` (dễ dùng, hợp Sheets) hoặc `googleapis` (chính thức, linh hoạt hơn). Auth: `Auth.js`.

---

## 3. Mô hình dữ liệu (mỗi sheet = một "bảng")

Quy ước: mỗi sheet có 2 cột hệ thống ở cuối — `NguoiCapNhat`, `NgayCapNhat` (truy vết ai sửa lúc nào). *Không cần cột `Version`/optimistic locking ở MVP vì chỉ một người ghi; thêm lại khi mở đa người dùng.*

### 3.1. `DonHang` — Đơn hàng (Giai đoạn 1)
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaDon | string (PK) | Mã đơn, vd `DH-2025-0142` |
| NgayNhan | date | Ngày nhận đơn |
| KhachHang | string | |
| NVKinhDoanh | string | Người bán phụ trách |
| TenSanPham | string | Vd: Hộp giấy, Catalogue |
| SoLuong | number | |
| KhoThanhPham | string | Vd `21x29.7` |
| LoaiGiay | string | Vd `Couche 250gsm` |
| SoMau | string | Vd `4/4`, `4/0` |
| GiaCongSauIn | string | Vd `Cán mờ; Bế; Dán hộp` |
| NgayGiaoHang | date | **Hạn giao (deadline)** |
| TrangThai | enum | `Moi` · `ChoChe ban` · `DaLenLich` · `DangSanXuat` · `HoanThanh` · `TreHen` · `Huy` |
| GhiChu | string | |

### 3.2. `LenhSanXuat` — Lệnh sản xuất / Job (đơn vị được xếp lịch)
Một đơn có thể sinh 1 hoặc nhiều lệnh. Đây là thực thể trung tâm.
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaLenh | string (PK) | `LSX-2025-0310` |
| MaDon | string (FK→DonHang) | |
| MoTaCongViec | string | |
| CongDoanCanLam | string | Vd `In;CanMang;Be;Dan` (thứ tự luồng) |
| TrangThaiFile | enum | **(Giai đoạn 2)** `ChoFile` · `DangCheBan` · `DaRaKem` · `SanSang` |
| DoUuTien | enum | `Thap` · `BinhThuong` · `Cao` · `Gap` |
| HanHoanThanh | date | Tính ngược từ NgayGiaoHang trừ thời gian đóng gói/vận chuyển |
| TrangThai | enum | `ChoLenLich` · `DaLenLich` · `DangChay` · `HoanThanh` |

### 3.3. `May` — Máy móc & năng lực
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaMay | string (PK) | |
| TenMay | string | Vd `Offset 4 màu #1` |
| Loai | enum | `InOffset` · `CanMang` · `Be` · `Dan` · `Khac` |
| KhoToiDa | string | Khổ in tối đa |
| NangSuat | number | tờ/giờ (để ước tính thời lượng) |
| ThoiGianMakeReady | number | phút chuẩn bị/đổi lệnh |
| TrangThai | enum | `HoatDong` · `BaoTri` · `Hong` |

**Dữ liệu mẫu để build & test logic xếp lịch ngay (thay bằng số thật của xưởng sau):**

| MaMay | TenMay | Loai | KhoToiDa | NangSuat (tờ/giờ) | MakeReady (phút) | TrangThai |
|---|---|---|---|---|---|---|
| M01 | Offset 4 màu #1 | InOffset | 52×74 cm | 8.000 | 40 | HoatDong |
| M02 | Offset 4 màu #2 | InOffset | 72×102 cm | 10.000 | 45 | HoatDong |
| M03 | Offset 1 màu | InOffset | 52×74 cm | 6.000 | 25 | HoatDong |
| M04 | Máy cán màng | CanMang | 76 cm | 2.500 | 15 | HoatDong |
| M05 | Máy bế tự động | Be | 72×102 cm | 4.000 | 45 | HoatDong |
| M06 | Máy dán hộp | Dan | — | 8.000 | 30 | HoatDong |

> Đây là con số *đại diện* cho xưởng offset nhỏ ở VN, đủ để lập trình và kiểm thử công thức tính thời lượng. **Công thức ước tính thời gian một công đoạn:**
> `Thời lượng (phút) = MakeReady + (SoLuong ÷ NangSuat) × 60`
> Ví dụ: in 20.000 tờ trên M02 → `45 + (20000 ÷ 10000) × 60 = 45 + 120 = 165 phút`.
> Khi bạn có số thật, chỉ cần sửa dữ liệu trong sheet `May`, không phải sửa code.
Mỗi bản ghi = một công đoạn của một lệnh được xếp vào một máy.
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaLich | string (PK) | |
| MaLenh | string (FK) | |
| CongDoan | enum | `In` · `CanMang` · `Be` · `Dan`… |
| MaMay | string (FK→May) | |
| ThuTu | number | Thứ tự chạy trên máy đó trong ngày |
| BatDauDuKien | datetime | |
| KetThucDuKien | datetime | |
| NguoiPhuTrach | string | |
| TrangThai | enum | `ChoChay` · `DangChay` · `Xong` |

### 3.5. `TienDo` — Nhật ký tiến độ (Giai đoạn 4)
Append-only (chỉ thêm dòng, không sửa). Đây là "sổ cái" — tránh được đa phần vấn đề ghi đè.
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaLog | string (PK) | |
| MaLenh | string (FK) | |
| CongDoan | enum | |
| ThoiGian | datetime | |
| TrangThaiMoi | string | |
| SoLuongDat | number | Số lượng đã hoàn thành công đoạn |
| NguoiCapNhat | string | |
| GhiChu | string | |

### 3.6. `PhatSinh` — Xử lý phát sinh (Giai đoạn 5)
| Cột | Kiểu | Mô tả |
|---|---|---|
| MaPhatSinh | string (PK) | |
| MaLenh | string (FK) | |
| Loai | enum | `MayHong` · `GiayTre` · `LechMau` · `DoiSoLuong` · `DonGap` · `Khac` |
| MoTa | string | |
| MucDo | enum | `Nhe` · `TrungBinh` · `Nghiem trong` |
| AnhHuongTienDo | boolean | Có làm trễ giao hàng không |
| HuongXuLy | string | |
| TrangThai | enum | `Moi` · `DangXuLy` · `DaXong` |
| ThoiGian | datetime | |

### 3.7. `NguoiDung` — Phân quyền *(khung sẵn, MVP chỉ 1 dòng: planner)*
Ở MVP chỉ có duy nhất một dòng — chính planner với `VaiTro = Planner`. Bảng này tồn tại để **sau này** mở tài khoản cho các bộ phận khác mà không phải đổi cấu trúc.
| Cột | Kiểu | Mô tả |
|---|---|---|
| Email | string (PK) | |
| HoTen | string | |
| VaiTro | enum | `Admin` · `Planner` · `KinhDoanh` · `CheBan` · `ToTruong` · `Xem` |
| BoPhan | string | |

**Sơ đồ quan hệ:**
```
DonHang 1──* LenhSanXuat 1──* LichChay *──1 May
                  │
                  ├──* TienDo
                  └──* PhatSinh
```

---

## 4. Phân tích chi tiết theo 6 giai đoạn

> **Lưu ý xuyên suốt:** ở MVP, *mọi màn hình đều do một mình planner sử dụng* — planner nhận dữ liệu từ Kinh doanh/Chế bản/Tổ trưởng qua kênh ngoài (Zalo, điện thoại, giấy) rồi nhập vào. Vì vậy cột "Quyền" bên dưới hiện chỉ là `Planner`; các vai trò khác ghi trong ngoặc là *dự phòng cho tương lai* khi mở tài khoản. Ưu tiên tối đa cho **tốc độ nhập liệu** — form ngắn, chọn nhanh, hạn chế gõ tay.

### Giai đoạn 1 — Tiếp nhận đơn hàng
**Chức năng:** Planner nhập đơn (nghe từ kinh doanh) → ghi vào `DonHang`, trạng thái `Moi`.

**Logic nghiệp vụ quan trọng — kiểm tra khả thi hạn giao:** Ngay khi nhập, hệ thống tính **thời gian sản xuất tối thiểu** = tổng thời lượng ước tính các công đoạn (dùng công thức ở mục 3.3) + đệm chế bản + đệm đóng gói. Nếu `NgayGiaoHang - hôm nay < thời gian tối thiểu` → hiện cảnh báo đỏ để planner báo kinh doanh thương lượng lại **trước khi** nhận đơn.

- **Màn hình:** Form tạo đơn (mobile-friendly); Danh sách đơn (filter theo trạng thái, khách).
- **Dữ liệu:** ghi `DonHang`.
- **Quyền:** `Planner` *(sau này: KinhDoanh tự nhập)*.

### Giai đoạn 2 — Kiểm tra file & chế bản
**Chức năng:** Planner chuyển đơn thành lệnh (`LenhSanXuat`) và cập nhật `TrangThaiFile` (nghe từ chế bản): `ChoFile → DangCheBan → DaRaKem → SanSang`.

**Một đơn → nhiều lệnh (tùy chọn):** mặc định tạo **1 lệnh** cho nhanh; có nút **"＋ Thêm lệnh"** để tách khi một đơn cần in nhiều hạng mục/nhiều đợt. Mỗi lệnh có `CongDoanCanLam` riêng.

**Điểm chốt (gate):** Một lệnh **chỉ được đưa vào xếp lịch (giai đoạn 3) khi `TrangThaiFile = SanSang`.** Hệ thống chặn/cảnh báo nếu cố xếp lệnh chưa có kẽm — đây là nguồn kẹt thực tế lớn nhất.

- **Màn hình:** Bảng "Chờ chế bản" (Kanban theo `TrangThaiFile`); nút tách/thêm lệnh.
- **Quyền:** `Planner` *(sau này: CheBan)*.

### Giai đoạn 3 — Lập kế hoạch & sắp xếp lệnh ⭐ (lõi hệ thống)
**Triết lý thiết kế: công cụ hỗ trợ quyết định, KHÔNG tự động xếp.** Planner vẫn là người quyết; hệ thống cung cấp thông tin để họ xếp giỏi hơn. **Màn hình này tối ưu cho desktop** (thao tác kéo/gán phức tạp).

**Màn hình chính — Bảng xếp lịch (Planning Board):**
- Cột = từng máy (`May`); hàng = timeline theo ngày/giờ.
- Danh sách "Lệnh chờ xếp" (đã `SanSang`) bên cạnh, sắp theo `HanHoanThanh` + `DoUuTien`.
- Planner gán lệnh vào máy (tạo bản ghi `LichChay`), hệ thống tự tính `BatDauDuKien`/`KetThucDuKien` dựa trên `NangSuat` + make-ready.

**Ba trợ lý quyết định mà hệ thống nên hiện (đây là giá trị thật):**
1. **Cảnh báo trễ hạn:** nếu lịch xếp làm `KetThucDuKien > HanHoanThanh` → tô đỏ.
2. **Gợi ý gom màu/khổ:** đánh dấu các lệnh cùng `SoMau`/`LoaiGiay`/`KhoThanhPham` để planner xếp liền nhau, giảm số lần make-ready (tiết kiệm giấy + thời gian).
3. **Cảnh báo tải máy & luồng công đoạn:** hiện % tải mỗi máy; cảnh báo nếu công đoạn sau (bế/dán) bị dồn khi công đoạn in đổ về cùng lúc.

- **Dữ liệu:** ghi `LichChay`; cập nhật `LenhSanXuat.TrangThai = DaLenLich` và `DonHang.TrangThai = DaLenLich`.
- **Quyền:** `Planner`.

### Giai đoạn 4 — Phát lệnh & theo dõi tiến độ 📱 (mobile-first)
**Chức năng:** Từ lịch đã chốt, xem danh sách lệnh đang chạy. Planner **cập nhật tiến độ qua điện thoại** (nghe từ tổ trưởng khi đi quanh xưởng) → ghi **append** một dòng vào `TienDo`.

**Vì sao `TienDo` append-only (vẫn giữ dù chỉ 1 người):** mỗi cập nhật là **một dòng mới** thay vì sửa ô cũ → giữ được *lịch sử* tiến độ (đơn chạy qua từng mốc lúc mấy giờ), phục vụ báo cáo và truy vết. Trạng thái hiện tại của lệnh = dòng `TienDo` mới nhất (tính ở tầng app).

- **Màn hình (thiết kế cho điện thoại):** Danh sách lệnh đang chạy; **cập nhật nhanh 3 chạm** — chọn lệnh → chọn công đoạn → nhập số lượng đạt → xong. Nút to, ít gõ.
- **Quyền:** `Planner` *(sau này: ToTruong tự cập nhật)*.

### Giai đoạn 5 — Xử lý phát sinh & sắp xếp lại
**Chức năng:** Planner ghi sự cố vào `PhatSinh` (cũng nên làm được trên điện thoại). Nếu `AnhHuongTienDo = true`, hệ thống:
- Đánh dấu các `LichChay` liên quan cần **xếp lại**.
- Đưa lệnh trở lại danh sách chờ của Planning Board.
- Cảnh báo các đơn có nguy cơ trễ để planner báo kinh doanh sớm.

**Đây là nơi hệ thống chứng minh giá trị nhất:** thay vì planner nhớ trong đầu "đơn nào bị ảnh hưởng khi máy #2 hỏng", hệ thống liệt kê ngay mọi lệnh đang xếp trên máy đó và mọi đơn có deadline sát.

- **Màn hình:** Form ghi phát sinh (mobile); bảng "Cần xử lý"; nút "xếp lại" đưa về giai đoạn 3.
- **Quyền:** `Planner`.

### Giai đoạn 6 — Báo cáo
**Chức năng:** Dữ liệu **suy ra** (derived), không lưu thành bảng riêng. Tính realtime từ các sheet.

Báo cáo nên có:
- **Báo cáo ngày:** đơn đã xong / đang chạy / có nguy cơ trễ (+ lý do lấy từ `PhatSinh`).
- **Tải máy:** % sử dụng từng máy theo tuần → phát hiện nút thắt cổ chai.
- **Đúng hạn (on-time rate):** % đơn giao đúng hạn theo tháng.
- **Thống kê phát sinh:** loại sự cố hay gặp nhất → cải tiến quy trình.

- **Màn hình:** Trang báo cáo có filter theo khoảng ngày; nút xuất Excel/PDF (để gửi quản lý).
- **Quyền:** `Planner`.

---

## 5. Các vấn đề kỹ thuật phải giải quyết

### 5.1. Ghi dữ liệu (đơn giản vì một người dùng)
Vì chỉ planner ghi, **không cần optimistic locking**. Thao tác ghi chỉ cần: đọc → sửa → ghi lại đúng dòng (dùng `MaXxx` làm khóa để tìm dòng). Vẫn nên:
- Ưu tiên **append** cho `TienDo` (giữ lịch sử tiến độ, không mất dữ liệu mốc thời gian).
- Cập nhật `NgayCapNhat` mỗi lần ghi để truy vết.
- *(Khi mở đa người dùng: thêm cột `Version` và kiểm tra trước khi ghi — chỗ đó đã chừa sẵn trong repository.)*

### 5.2. Mobile-first & phản hồi nhanh
- Vì cập nhật qua điện thoại, thiết kế **responsive**; các luồng nhập nhanh/cập nhật tiến độ ưu tiên màn hình nhỏ, nút to, ít gõ.
- Dùng **optimistic UI**: bấm xong cập nhật hiện ngay trên màn, ghi Sheets chạy nền → cảm giác mượt dù latency Sheets ~vài trăm ms.

### 5.3. Cache & tốc độ
- **Cache toàn sheet ở server** (đọc 1 lần → giữ trong RAM, lọc/join trong code) — với 1 người dùng là quá đủ, gần như không đụng quota.
- **Không** gọi Sheets trực tiếp từ client — luôn qua Route Handler (bảo mật service-account key).

### 5.4. Xác thực
- `Auth.js` + Google Provider, **chỉ cho đúng email của planner** đăng nhập (allowlist). Đơn giản, an toàn, không cần hệ phân quyền phức tạp ở MVP.

### 5.5. Toàn vẹn tham chiếu (thủ công)
Sheets không có FK. App phải tự kiểm: không cho xóa `May` đang có `LichChay`; không cho tạo `LenhSanXuat` với `MaDon` không tồn tại. Dồn các kiểm tra này vào Repository layer.

### 5.6. Archive
Cuối mỗi tháng, chuyển các đơn/lệnh `HoanThanh` sang sheet `Archive_YYYY_MM` để sheet chính luôn nhẹ, truy vấn nhanh.

---

## 6. Lộ trình triển khai (đề xuất build theo pha)

**Pha 1 — Nền tảng + Giai đoạn 1–2 (tuần 1–2)**
Auth, Repository layer, sheet `DonHang`/`LenhSanXuat`/`NguoiDung`, form nhập đơn + kiểm tra khả thi hạn giao, bảng chế bản. → *Đã dùng được để thay việc nhập tay.*

**Pha 2 — Giai đoạn 3–4 (tuần 3–5, khó nhất)**
Planning Board, 3 trợ lý quyết định, phát lệnh, dashboard tiến độ (`TienDo` append). → *Đây là lõi, đầu tư nhiều nhất.*

**Pha 3 — Giai đoạn 5 (tuần 6)**
Ghi phát sinh + luồng xếp lại + cảnh báo trễ.

**Pha 4 — Giai đoạn 6 (tuần 7)**
Báo cáo + xuất file.

> Sau mỗi pha đều có phần dùng được ngay — không "build 2 tháng rồi mới thấy mặt".

---

## 7. Rủi ro & khuyến nghị

- **Nút cổ chai là con người, không phải công nghệ.** Vì mọi dữ liệu dồn qua planner nhập tay, khi khối lượng tăng, chính planner (không phải Sheets) sẽ quá tải. Dấu hiệu nên mở tài khoản cho các bộ phận tự nhập: planner mất >1–2 giờ/ngày chỉ để gõ lại dữ liệu người khác đọc cho.
- **Ngưỡng chuyển DB thật:** chỉ cần cân nhắc **Supabase/Neon (Postgres)** khi mở nhiều người dùng cùng ghi (lúc đó mới lo ghi đè). Nhờ Repository layer, chỉ viết lại lớp trong, ~1–2 ngày công. Ở mô hình một người dùng hiện tại, **chưa cần**.
- **Đừng làm auto-scheduler** — planner giỏi vẫn xếp tốt hơn thuật toán ở xưởng nhỏ. Tập trung vào 3 trợ lý quyết định.
- **Sao lưu:** bật lịch sử phiên bản Google Sheets + export định kỳ.
- **Số liệu máy là "linh hồn" của phần xếp lịch:** hiện dùng dữ liệu mẫu (mục 3.3). Cập nhật số thật sớm nhất có thể, nếu không cảnh báo trễ hạn sẽ sai lệch.

---

## 8. Các quyết định đã chốt & việc cần làm tiếp

**Đã chốt (từ trao đổi):**
1. ✅ Một đơn → **nhiều lệnh (tùy chọn)** — mô hình 1→N, UI mặc định 1 lệnh + nút "＋ Thêm lệnh".
2. ✅ Số liệu máy **điền sau** — dùng **dữ liệu mẫu** ở mục 3.3 để build & test logic xếp lịch ngay bây giờ.
3. ✅ Cập nhật tiến độ **qua điện thoại** → mobile-first cho các luồng nhập/cập nhật.
4. ✅ **Chưa** tích hợp kho — ngoài phạm vi.
5. ✅ **Một người dùng (planner)** → bỏ locking, đăng nhập allowlist 1 email, giữ khung phân quyền cho tương lai.

**Việc cần làm tiếp khi bắt tay build:**
- Điền số thật vào sheet `May` (năng suất tờ/giờ + make-ready từng máy) — chỉ sửa dữ liệu, không sửa code.
- Xác định các giá trị "đệm": bao nhiêu ngày cho chế bản, bao nhiêu giờ cho đóng gói/giao — để công thức kiểm tra khả thi hạn giao chính xác.
- Chốt danh sách công đoạn chuẩn của xưởng (`In`, `CanMang`, `Be`, `Dan`, `EpKim`…) để làm enum `CongDoan`.
