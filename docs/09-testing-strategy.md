# 09. Chiến lược kiểm thử

## 1. Ba tầng kiểm thử

| Tầng | Công cụ | Kiểm cái gì | Tỷ lệ ước tính | Tốc độ |
|---|---|---|---|---|
| Đơn vị | Vitest | Hàm thuần trong `features/*/domain`, schema Zod | ~70% số test | Mili giây |
| Tích hợp | Vitest + PostgreSQL thật | Tầng dịch vụ và Route Handler: quyền, giao dịch, bất biến | ~25% | Giây |
| Đầu-cuối (E2E) | Playwright | Luồng người dùng chính trên trình duyệt thật | ~5% | Phút |

Lý do tỷ lệ này: logic khó nhất (tiến độ, burndown, lặp lịch, múi giờ) nằm ở hàm thuần, test nhanh và chính xác. Test E2E chậm và dễ chập chờn nên chỉ dành cho vài luồng quan trọng.

## 2. Quy ước

- Test đơn vị đặt cạnh file nguồn: `burndown.ts` ↔ `burndown.test.ts`.
- Test tích hợp: `tests/integration/*.test.ts`. Mỗi file chạy trên một schema PostgreSQL riêng, làm sạch dữ liệu giữa các test.
- Test E2E: `tests/e2e/*.spec.ts`. Chạy trên bản build production với DB đã seed.
- Tên test bằng tiếng Việt hoặc tiếng Anh đều được, nhưng phải ghi mã: `it("TC-01 tiến độ = 0 khi không có việc", ...)`.
- Không dùng thời gian thật: truyền `now` vào hàm thuần; test tích hợp dùng `vi.setSystemTime`.
- Test ngày giờ chạy với ít nhất hai múi giờ: `Asia/Ho_Chi_Minh` (UTC+7) và `America/New_York` (có giờ mùa hè) để bắt lỗi múi giờ.

## 3. Danh sách ca kiểm thử bắt buộc

### 3.1 Tiến độ (đơn vị) — file 07

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-01 | Không có việc nào | $P = 0$, $P_w = 0$, không lỗi |
| TC-02 | 3 việc ước lượng 2, 3, 5; việc 5 xong | $P \approx 33{,}3\%$, $P_w = 50\%$ |
| TC-03 | 4 việc: 3 (xong), 5, không ước lượng (xong), không ước lượng | $P_w = 40\%$, `reliable = true` |
| TC-04 | 4 việc, chỉ 1 có ước lượng | `reliable = false` |
| TC-05 | Việc A + việc B có 3 việc con; A và B1 xong | Tập lá có 4 phần tử; $P = 50\%$ |
| TC-06 | Có việc đã xóa và mốc dự án | Bị loại khỏi tập đếm |
| TC-07 | Mọi việc ước lượng 0 | $P_w = 0$, không chia cho 0 |

### 3.2 Velocity và burndown (đơn vị)

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-08 | Velocity 18, 21, 15, 24 | $\bar v = 20$ |
| TC-09 | Velocity 18, 21 | $\bar v = 19{,}5$ |
| TC-10 | Chưa có sprint xong | $\bar v$ = `null` |
| TC-11 | Ví dụ burndown mục 6.5 file 07 | Đúng từng dòng bảng: remaining 20, 17, 16, 8, 8, 4; scope 20, 20, 24, 24, 24, 24; ideal 20, 16, 12, 8, 4, 0 |
| TC-11b | Sự kiện lúc 23:30 giờ Việt Nam (16:30 UTC) | Được tính vào đúng ngày theo giờ Việt Nam |
| TC-11c | Hôm nay là ngày 3 của sprint 5 ngày | Ngày 4, 5 có `remaining = null` |

### 3.3 Bất biến dữ liệu (tích hợp) — file 04 mục 4

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-12 | Chuyển việc từ cột TODO sang cột DONE | `statusCategory = DONE`, `completedAt` có giá trị, có `ActivityLog` |
| TC-12b | Chuyển ngược từ DONE về IN_PROGRESS | `completedAt = null` |
| TC-12c | Đổi nhóm trạng thái của cột từ IN_PROGRESS sang DONE | Mọi việc trong cột đổi theo trong một giao dịch |
| TC-13 | Người dùng A gọi API với id việc của người dùng B | `404`; dữ liệu B không đổi |
| TC-14 | Tạo việc con của việc con | `422 SUBTASK_DEPTH_EXCEEDED` |
| TC-15 | Xóa cột DONE duy nhất | `422 BOARD_NEEDS_TODO_AND_DONE` |
| TC-16 | Xóa việc cha rồi khôi phục | Việc con bị xóa cùng lúc được khôi phục; việc con đã xóa từ trước thì không |
| TC-17 | Sửa hàng loạt 3 việc, việc thứ 3 không tồn tại | Không việc nào thay đổi |

### 3.4 Kanban và WIP

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-20 | Thả việc vào cột đầy, chế độ cảnh báo | `200` kèm `warnings: ["WIP_LIMIT_EXCEEDED"]` |
| TC-21 | Thả việc vào cột đầy, `wipStrict = true` | `409 WIP_LIMIT_EXCEEDED`, việc không đổi |
| TC-22 | Sắp xếp lại trong chính cột đầy, `wipStrict = true` | Được phép |
| TC-23 | Việc con không tính vào WIP | Cột 3 việc cha (mỗi việc 2 việc con), giới hạn 3 → không vượt |
| TC-24 | Chèn 100 lần liên tiếp vào cùng một vị trí | Khóa `order` vẫn đúng thứ tự, không trùng |
| TC-25 | (Tích hợp) Sinh 200 khóa `order` ngẫu nhiên bằng `src/lib/ordering.ts`, ghi vào DB, đọc lại bằng Prisma `orderBy: { order: "asc" }` | Thứ tự trả về từ DB trùng hoàn toàn với mảng sắp bằng toán tử `<` trong JS (ADR-05, collation `"C"`) |

### 3.5 Scrum (tích hợp)

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-30 | Bắt đầu sprint thứ hai khi đã có sprint đang chạy | `409 SPRINT_ALREADY_ACTIVE` |
| TC-31 | Hai yêu cầu bắt đầu sprint gửi đồng thời | Đúng một thành công (chỉ mục duy nhất từng phần) |
| TC-32 | Thêm việc thiếu ước lượng vào sprint | `422 ESTIMATE_REQUIRED` |
| TC-33 | Kết thúc sprint, chọn `BACKLOG` | Việc xong giữ `sprintId`; việc dở về `sprintId = null`; `velocity` lưu đúng |
| TC-34 | Kết thúc sprint, chọn `NEXT_SPRINT` | Việc dở chuyển sang sprint được chọn |
| TC-35 | Bắt đầu sprint | `committedPoints` = tổng điểm lúc bắt đầu |

### 3.6 Lịch học và lặp lại (đơn vị)

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-40 | Buổi học thứ Hai 07:00–09:30, kỳ 01/09–15/12, xem tuần 02/11–08/11 | Đúng 1 buổi, 07:00 giờ Việt Nam = 00:00 UTC |
| TC-41 | Buổi học có ngoại lệ hủy ngày 09/11 (thứ Hai) | Buổi đó có `cancelled = true` |
| TC-42 | Khoảng xem ngoài kỳ học | Không có buổi nào |
| TC-43 | Người dùng ở New York, buổi 07:00 qua ngày đổi giờ mùa hè | Vẫn 07:00 giờ địa phương (BR-53) |
| TC-44 | `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4` từ thứ Hai 02/11 | 02/11, 04/11, 09/11, 11/11 |
| TC-45 | `FREQ=DAILY;INTERVAL=2;UNTIL=20261110` từ 03/11 | 03/11, 05/11, 07/11, 09/11 |
| TC-46 | Quy tắc `FREQ=MONTHLY` | Lỗi `INVALID_RECURRENCE_RULE` |
| TC-47 | Gọi tạo lần xuất hiện hai lần cho cùng ngày | Chỉ một `Task` (BR-73) |
| TC-48 | Ngày nằm trong `skipDates` | Không tạo |

### 3.7 Điểm môn học (đơn vị)

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-50 | Ví dụ mục 7.3 file 07 | $A = 3{,}0$; $\bar g = 7{,}5$; $x \approx 8{,}33$; `POSSIBLE` |
| TC-51 | Cùng ví dụ, mục tiêu 9,5 | $x = 6{,}5/0{,}6 \approx 10{,}83$ → `IMPOSSIBLE`; `maxPossible = 9{,}0` |
| TC-52 | Mục tiêu 3 | $x \le 0$ → `ACHIEVED` |
| TC-53 | Mọi thành phần có điểm | `FINAL`, `needed = null` |
| TC-54 | Trọng số 10 + 30 + 50 | `weightSum = 90` để giao diện cảnh báo |
| TC-55 | Chưa có điểm nào | `current = null`, $x = T^*$ |

### 3.8 Trễ hạn và múi giờ (đơn vị)

| Mã | Ca kiểm | Kết quả mong đợi |
|---|---|---|
| TC-60 | Hạn cả ngày 03/11, bây giờ 03/11 23:59 giờ Việt Nam | Chưa trễ |
| TC-61 | Hạn cả ngày 03/11, bây giờ 04/11 00:00 giờ Việt Nam | Trễ |
| TC-62 | Hạn 03/11 14:00, bây giờ 14:01 | Trễ |
| TC-63 | Việc DONE có hạn đã qua | Không trễ |
| TC-64 | Múi giờ `America/New_York`, hạn cả ngày rơi vào ngày đổi giờ năm 2026. **(a)** Hạn 08/03/2026 (ngày dài 23 giờ, bắt đầu giờ mùa hè), `now` = 09/03 00:30 giờ New York (= 04:30 UTC). **(b)** Hạn 01/11/2026 (ngày dài 25 giờ, kết thúc giờ mùa hè), `now` = 01/11 23:30 giờ New York (= 02/11 04:30 UTC) | (a) **trễ** — nếu cộng 24 giờ thì mốc thành 01:00 ngày 09/03 và sai thành "chưa trễ". (b) **chưa trễ** — nếu cộng 24 giờ thì mốc thành 23:00 ngày 01/11 và sai thành "trễ". Mốc đúng là 00:00 ngày lịch kế tiếp (NFR-32) |

## 4. Luồng đầu-cuối (Playwright)

| Mã | Luồng | Giai đoạn |
|---|---|---|
| TC-90 | Đăng ký → vào Hôm nay → tạo việc nhanh → thấy việc trong danh sách | P0/MVP-1 |
| TC-91 | Tạo dự án → thêm 3 việc → kéo 1 việc sang "Xong" → tiến độ hiện 33% → tải lại trang vẫn đúng | MVP-1 |
| TC-92 | Kéo thả bằng bàn phím: Space, mũi tên phải, Space → việc sang cột kế | MVP-1 |
| TC-93 | Tạo môn có lịch học thứ Hai → mở Lịch tuần → thấy buổi học đúng giờ, đúng màu | MVP-2 |
| TC-94 | Nhập điểm thành phần → thấy điểm cần đạt | MVP-2 |
| TC-95 | Tạo sprint → thêm việc có ước lượng → bắt đầu → kéo việc sang Xong → kết thúc → velocity hiện ở báo cáo | MVP-3 |
| TC-96 | Màn hình điện thoại 390×844: điều hướng dưới cùng, mở tấm trượt việc | MVP-2 |

## 5. Kiểm tra khả năng truy cập

- Chạy `@axe-core/playwright` trong mỗi test E2E; lỗi mức "serious" trở lên làm test thất bại.
- Trước mỗi giai đoạn: kiểm thủ công với trình đọc màn hình (NVDA hoặc VoiceOver) cho luồng TC-91 và TC-92.

## 6. Điều kiện "xong" về kiểm thử

Một thay đổi chỉ được coi là xong khi:

1. `npm run lint`, `npm run typecheck`, `npm run test` không lỗi.
2. Mọi `BR-xx` mà thay đổi đụng tới có ít nhất một test tương ứng.
3. Thay đổi giao diện của luồng chính: `npm run test:e2e` cho các TC liên quan không lỗi.
