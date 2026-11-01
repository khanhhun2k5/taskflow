# 06. Đặc tả giao diện và trải nghiệm

## 1. Nguyên tắc

1. **Nhanh hơn giấy.** Thao tác thường gặp (tạo việc, đánh dấu xong, chuyển cột) phải xong trong một hoặc hai lần bấm.
2. **Một việc, nhiều cách nhìn.** Sửa việc ở bất kỳ màn hình nào cũng mở cùng một hộp thoại `TaskDialog`.
3. **Phản hồi tức thì.** Mọi thay đổi hiện ngay trên giao diện (cập nhật lạc quan); lỗi thì hoàn tác và hiện thông báo kèm nút "Thử lại".
4. **Dùng được bằng bàn phím và trình đọc màn hình** (NFR-20…23).

## 2. Bố cục và điều hướng

**Máy tính (≥ 1024px):** thanh bên trái cố định, nội dung bên phải.

```
┌──────────────┬───────────────────────────────────────────┐
│ TaskFlow     │  Tiêu đề trang          [Tìm ⌘K] [🔔] [👤]│
│              ├───────────────────────────────────────────┤
│ ▸ Hôm nay    │                                           │
│ ▸ Hộp thư  3 │                                           │
│ ▸ Lịch       │              Nội dung                     │
│              │                                           │
│ MÔN HỌC      │                                           │
│ ● Kho dữ liệu│                                           │
│ ● TMĐT       │                                           │
│ + Thêm môn   │                                           │
│              │                                           │
│ DỰ ÁN        │                                           │
│ ■ Website    │                                           │
│ + Thêm dự án │                                           │
│              │                                           │
│ Thùng rác    │                                           │
│ Cài đặt      │                                           │
└──────────────┴───────────────────────────────────────────┘
```

**Điện thoại (< 768px):** thanh điều hướng dưới cùng gồm 4 mục: Hôm nay, Lịch, Dự án & Môn, Thêm (+). Danh sách môn và dự án nằm trong mục "Dự án & Môn". Hộp thoại mở dạng tấm trượt từ dưới lên (sheet).

**Máy tính bảng (768–1023px):** thanh bên thu gọn chỉ còn biểu tượng.

## 3. Danh sách màn hình

| Đường dẫn | Màn hình | Thành phần chính | Story |
|---|---|---|---|
| `/login`, `/register` | Đăng nhập, đăng ký | Form email/mật khẩu, nút Google | US-01, 02 |
| `/today` | Hôm nay | `OverdueSection`, `DayTimeline`, `DueTodayList`, `UpcomingList`, `QuickAdd` | US-34 |
| `/inbox` | Hộp thư | `ListView` các việc lẻ, `QuickAdd` | US-10 |
| `/calendar?view=day\|week\|month&date=` | Lịch | `DayGrid`, `WeekGrid`, `MonthGrid`, ngăn bên "Chưa xếp lịch" | US-35, 36 |
| `/projects` | Danh sách dự án | `ProjectCard` có thanh tiến độ, lọc Đang làm/Đã lưu trữ | US-14, 18 |
| `/projects/[id]?view=kanban\|list\|calendar\|sprint` | Dự án | Thanh tab kiểu xem, `ProgressHeader`, bảng tương ứng | US-15…20 |
| `/projects/[id]/backlog` | Backlog & lập sprint (Scrum) | `BacklogList`, `SprintPlanner` | US-40, 41 |
| `/projects/[id]/reports` | Báo cáo (Scrum) | `BurndownChart`, `VelocityChart` | US-43, 44 |
| `/courses` | Danh sách môn | `CourseCard`: màu, buổi học kế tiếp, số việc sắp hạn, điểm hiện tại | US-30 |
| `/courses/[id]?tab=overview\|board\|grades` | Môn học | Tổng quan (lịch học + việc sắp hạn), Bảng (Kanban), Điểm (`GradeTable`) | US-31…33 |
| `/search` | Tìm kiếm | Kết quả nhóm theo loại | BR-82 |
| `/trash` | Thùng rác | Danh sách đã xóa, nút Khôi phục | US-13 |
| `/settings` | Cài đặt | Hồ sơ, múi giờ, ngôn ngữ, giao diện sáng/tối, ngày đầu tuần, nhãn | US-03 |

## 4. Thành phần chính

### 4.1 `QuickAdd` (tạo việc nhanh)

- Một ô nhập, placeholder "Thêm việc… (Enter để lưu)".
- Enter: tạo việc với ngữ cảnh hiện tại (đang ở dự án → gán dự án; đang ở cột → gán cột; ở Hôm nay → hạn hôm nay).
- Sau khi tạo, ô trống lại và giữ tiêu điểm.
- Esc: xóa nội dung, bỏ tiêu điểm.
- Chuỗi rỗng hoặc chỉ khoảng trắng: không làm gì.

### 4.2 `TaskCard` (thẻ việc trên bảng)

Hiển thị theo thứ tự: chấm màu môn (nếu có) · tiêu đề (tối đa 3 dòng) · hàng thông tin: biểu tượng ưu tiên, hạn (đỏ nếu trễ, cam nếu hôm nay), ước lượng, "2/5" việc con, nhãn (tối đa 3, còn lại "+2"). Mốc dự án có biểu tượng hình thoi.

Bấm thẻ → mở `TaskDialog`. Thẻ có `role="button"` và nhãn đọc đầy đủ: "Việc: Viết báo cáo, hạn 3 tháng 11, ưu tiên cao, trễ hạn".

### 4.3 `TaskDialog` (chi tiết việc)

- Bên trái: tiêu đề (sửa tại chỗ), mô tả Markdown (xem/sửa), danh sách việc con (thêm bằng Enter, đánh dấu, kéo sắp xếp), lịch sử hoạt động.
- Bên phải: trạng thái (chọn cột hoặc ô đánh dấu), ưu tiên, hạn (chọn ngày, công tắc "Cả ngày", giờ), ngày bắt đầu, ước lượng (kèm đơn vị của dự án), dự án, môn học, nhãn, mốc, nhắc hạn (P4), lặp lại (P4).
- Lưu tự động sau 500 ms ngừng gõ; có dấu "Đã lưu".
- Mở bằng tham số URL `?task=<id>` trên trang đang xem (MVP-1 c1): mọi trang dùng chung một hộp thoại, tải lại trang vẫn mở đúng việc, nút Quay lại đóng hộp thoại.
- Trên điện thoại: mở toàn màn hình.

### 4.4 `KanbanBoard`

- Cột cuộn ngang; mỗi cột cuộn dọc riêng.
- Tiêu đề cột: tên, số việc, giới hạn WIP dạng "3/4". Vượt giới hạn: viền và số chuyển màu đỏ (BR-29).
- Menu cột: đổi tên, nhóm trạng thái, đặt WIP, thêm cột bên trái/phải, xóa (hỏi cột đích).
- Cuối mỗi cột: `QuickAdd` gọn.
- Kéo thả: chuột, cảm ứng (nhấn giữ 200 ms), bàn phím (Space nhặt, mũi tên di chuyển, Space thả, Esc hủy). Trình đọc màn hình đọc thông báo: "Đã nhặt Viết báo cáo. Đang ở cột Đang làm, vị trí 2 trên 4."
- Trong dự án Scrum, đầu trang có bộ chọn phạm vi (BR-47): **"Sprint hiện tại"** (mặc định) chỉ hiện việc thuộc sprint `ACTIVE`; **"Tất cả"** hiện mọi việc của dự án, kể cả việc ở backlog. Không có sprint đang chạy: trạng thái trống "Chưa có sprint đang chạy" kèm nút tới Backlog.

### 4.5 `ListView`

- Bảng cột: ô chọn, tiêu đề, trạng thái, ưu tiên, hạn, ước lượng, dự án/môn, nhãn.
- Sắp xếp bằng cách bấm tiêu đề cột. Lọc bằng thanh lọc phía trên; bộ lọc ghi vào URL để chia sẻ/lưu dấu trang.
- Chọn nhiều: thanh hành động nổi ở dưới (BR-31).
- Nhiều hơn 100 dòng thì dùng danh sách ảo (virtualized, `@tanstack/react-virtual`) để giữ mượt.

### 4.6 Lịch (`DayGrid`, `WeekGrid`, `MonthGrid`)

- Ngày/tuần: trục giờ 6:00–23:00 (cuộn được ra 0:00–24:00), bước 15 phút. Vạch đỏ ở giờ hiện tại.
- Hàng trên cùng "Cả ngày": việc có hạn cả ngày.
- Buổi học: khối màu môn, nền sọc nhẹ, không kéo được (sửa ở trang môn). Buổi bị hủy: gạch ngang, mờ.
- Khung giờ: kéo để dời, kéo mép dưới để đổi thời lượng (BR-61).
- Ngăn bên phải "Chưa xếp lịch": việc đến hạn trong 7 ngày chưa có khung giờ; kéo vào lưới để tạo khung giờ.
- Tháng: mỗi ô ngày hiện tối đa 3 mục, còn lại "+N"; bấm mở danh sách ngày đó.

### 4.7 Scrum

- `BacklogList`: danh sách kéo thả sắp xếp; mỗi dòng có ô ước lượng sửa tại chỗ; việc thiếu ước lượng có nhãn vàng "Chưa ước lượng".
- `SprintPlanner`: hai cột backlog | sprint. Thanh trên: "18 / 21 điểm (velocity dự kiến)". Nút "Bắt đầu sprint" mở hộp thoại xác nhận tên, mục tiêu, ngày.
- Kết thúc sprint: hộp thoại tổng kết "Hoàn thành 15/21 điểm. 2 việc chưa xong → [Về backlog | Sang sprint kế]".
- `BurndownChart`: trục ngang là ngày, trục dọc là điểm; đường lý tưởng nét đứt, đường thực tế nét liền; điểm có thay đổi phạm vi có chấm và chú thích khi rê chuột.
- `VelocityChart`: cột đôi "Cam kết" và "Hoàn thành" cho mỗi sprint; đường ngang trung bình.

### 4.8 `GradeTable`

| Thành phần | Trọng số | Điểm | Tối đa | Quy về 10 |
|---|---|---|---|---|
| Chuyên cần | 10% | 9 | 10 | 9,0 |
| Giữa kỳ | 30% | 14 | 20 | 7,0 |
| Cuối kỳ | 60% | — | 10 | — |

Bên dưới bảng: "Điểm hiện tại (trên phần đã có): **7,50**", "Để đạt **8,0** bạn cần trung bình **8,33** ở phần còn lại". Tổng trọng số ≠ 100% thì hiện cảnh báo vàng (BR-55). Công thức ở file 07.

## 5. Phím tắt

Phím tắt chữ cái chỉ hoạt động khi tiêu điểm **không** nằm trong ô nhập.

| Phím | Hành động |
|---|---|
| `n` | Tiêu điểm vào ô tạo việc nhanh của trang |
| `⌘K` / `Ctrl+K` | Mở bảng lệnh và tìm kiếm |
| `g` rồi `t` | Đến Hôm nay |
| `g` rồi `c` | Đến Lịch |
| `g` rồi `i` | Đến Hộp thư |
| `1` `2` `3` `4` | Đổi kiểu xem: Kanban, Danh sách, Lịch, Sprint |
| `e` | Mở việc đang chọn |
| `x` | Chọn/bỏ chọn việc (Danh sách) |
| `Shift+D` | Đánh dấu xong việc đang chọn |
| `?` | Hiện bảng phím tắt |

## 6. Trạng thái màn hình

Mọi màn hình có dữ liệu phải thiết kế đủ 4 trạng thái:

| Trạng thái | Cách hiển thị |
|---|---|
| Đang tải | Khung xương (skeleton) đúng bố cục, không dùng vòng xoay toàn trang |
| Trống | Minh họa nhỏ + một câu hướng dẫn + nút hành động. Ví dụ Hôm nay trống: "Hôm nay bạn rảnh! Thêm việc hoặc xem lịch tuần." |
| Lỗi | Thông báo dễ hiểu + nút "Thử lại"; không hiện chi tiết kỹ thuật |
| Có dữ liệu | Như mô tả ở mục 4 |

## 7. Giao diện trực quan

- Dùng biến màu (token) của shadcn/ui; chế độ sáng, tối, và theo hệ thống.
- Màu môn học/dự án do người dùng chọn từ bảng 12 màu có sẵn, đã kiểm tra tương phản trên cả nền sáng và tối (`src/features/projects/domain/palette.ts`, test ≥ 3:1 với nền sáng và tối, NFR-22).
- Màu ưu tiên: Khẩn cấp đỏ, Cao cam, Trung bình xanh dương, Thấp xám. Luôn đi kèm biểu tượng, không chỉ dựa vào màu.
- Phông chữ: Inter (có đủ ký tự tiếng Việt), cỡ chữ nền 14px trên máy tính, 16px trên điện thoại.
- Chữ hiển thị: lấy từ `messages/vi.json` / `messages/en.json`; không viết chuỗi cứng trong component.
- Định dạng: ngày `dd/MM/yyyy` (vi), số thập phân dấu phẩy (vi) — dùng `Intl` theo ngôn ngữ người dùng.
