# 10. Lộ trình

Mỗi giai đoạn kết thúc bằng một bản chạy được và dùng được thật. Chỉ làm giai đoạn đang được yêu cầu; không làm trước phần của giai đoạn sau.

Thời lượng ước tính cho **một người làm bán thời gian** (khoảng 15 giờ/tuần). Đây là ước tính thô để lên kế hoạch, không phải cam kết.

| Giai đoạn | Nội dung chính | Ước tính |
|---|---|---|
| P0 | Nền móng: khởi tạo, DB, xác thực, CI, bố cục | 1 tuần |
| MVP-1 | Việc, dự án, Kanban, Danh sách, tiến độ | 2–3 tuần |
| MVP-2 | Môn học, lịch học, điểm, Hôm nay, Lịch, khung giờ | 2–3 tuần |
| MVP-3 | Scrum: backlog, sprint, burndown, velocity | 2 tuần |
| P4 | Việc lặp, nhắc hạn, xuất CSV/ICS, thùng rác tự dọn | 2 tuần |
| P5 | PWA, hoàn thiện, tối ưu hiệu năng | 1 tuần |

## P0. Nền móng

**Phạm vi**

- Khởi tạo Next.js 16 + TypeScript strict + Tailwind 4 + shadcn/ui + ESLint + Prettier.
- `docker-compose.yml` cho PostgreSQL; Prisma 7; migration đầu tiên chỉ có bảng xác thực (gồm `RateLimit`) và `User`.
- Better Auth: đăng ký/đăng nhập email, đăng xuất; Google là tùy chọn, chỉ bật khi đủ biến môi trường (US-02, file 03 mục 5).
- Rate limit có sẵn của Better Auth cho route xác thực, bộ đếm lưu DB (NFR-11 (a)).
- Chặn trang `(app)` theo ADR-11: file chặn route (tên theo tài liệu Next.js 16, tra cứu và ghi nguồn khi tạo) chỉ kiểm tra cookie; kiểm tra phiên đầy đủ ở layout `(app)` và `withUser`.
- `src/server/http.ts` (`withUser`, xử lý lỗi), `src/server/errors.ts`, `src/lib/env.ts`, `src/lib/dates.ts`.
- next-intl với `vi.json`, `en.json`; chế độ sáng/tối.
- Bố cục: thanh bên (máy tính), điều hướng dưới (điện thoại), trang Hôm nay rỗng.
- Vitest, Playwright, GitHub Actions.

**Xong khi**

- [x] US-01, US-02, US-03 đạt tiêu chí chấp nhận. _(2026-11-01: `tests/integration/auth.test.ts`, `me.test.ts`; E2E `auth.spec.ts` — đăng ký vào thẳng Hôm nay, ẩn nút Google khi chưa cấu hình.)_
- [x] TC-90 (phần đăng ký → Hôm nay) chạy qua. _(2026-11-01: `npm run test:e2e`, 11/11 qua, kèm axe sáng/tối trên `/login`, `/today`.)_
- [x] CI xanh trên pull request. _(2026-11-01: PR #1 `p0c-ui-i18n-ci` → `master`, job `check` xanh, đã merge.)_
- [x] `.env.example` đầy đủ; README hướng dẫn chạy từ đầu trong ≤ 5 lệnh. _(2026-11-01: `.env.example` khớp file 03 mục 5; `npm run env:init` và `prisma migrate dev` đã thử trên DB trống.)_

## MVP-1. Việc, dự án, Kanban

**Phạm vi**

- Model: `Project`, `Board`, `Column`, `Task`, `Label`, `TaskLabel`, `ActivityLog` (+ ràng buộc viết tay liên quan, file 04 mục 3).
- API mục 2.2, 2.3, 2.4 (`progress`), 2.8 (nhãn) của file 05.
- Giao diện: Hộp thư, danh sách dự án, trang dự án với Kanban và Danh sách, `TaskDialog`, `QuickAdd`, Thùng rác.
- Hàm thuần: `progress.ts`, `ordering.ts`, kiểm tra WIP.

**Xong khi**

- [ ] US-10 … US-19 đạt tiêu chí chấp nhận. _(2026-11-01: có test cho US-10…19, trừ kéo bằng cảm ứng của US-15 — cần thử thủ công trên điện thoại; xem PROGRESS.md)_
- [x] TC-01 … TC-07, TC-12 … TC-17, TC-20 … TC-25, TC-60 … TC-64 chạy qua. _(`npm run test:coverage`, 2026-11-01)_
- [x] TC-91, TC-92 chạy qua. _(`tests/e2e/kanban.spec.ts`, 2026-11-01)_
- [x] NFR-03: đạt (≤ 100 việc); 500 việc chuyển P5. _(số đo: docs/08, docs/PROGRESS.md; 2026-11-01)_

## MVP-2. Môn học và lịch trình

**Phạm vi**

- Model: `Course`, `ClassSession`, `ClassSessionException`, `GradeComponent`, `TimeBlock`.
- API mục 2.6, 2.7, `search` của file 05.
- Hàm thuần: `expandClassSessions`, `computeGrades`, gộp agenda.
- Giao diện: danh sách môn, trang môn (Tổng quan, Bảng, Điểm), trang Hôm nay đầy đủ, Lịch ngày/tuần/tháng, kéo việc vào khung giờ, kiểu xem Lịch của dự án (US-20), tìm kiếm ⌘K.

**Xong khi**

- [ ] US-20, US-30 … US-36 đạt tiêu chí chấp nhận.
- [ ] TC-40 … TC-43, TC-50 … TC-55 chạy qua.
- [ ] TC-93, TC-94, TC-96 chạy qua.

## MVP-3. Scrum

**Phạm vi**

- Model: `Sprint` (+ chỉ mục một sprint ACTIVE).
- API mục 2.5 và `burndown`, `velocity` của file 05.
- Hàm thuần: `computeBurndown`, `sprintVelocity`, `expectedVelocity`.
- Giao diện: Backlog, lập sprint, bảng sprint, hộp thoại kết thúc sprint, trang Báo cáo (burndown, velocity).

**Xong khi**

- [ ] US-40 … US-44 đạt tiêu chí chấp nhận.
- [ ] TC-08 … TC-11c, TC-30 … TC-35 chạy qua.
- [ ] TC-95 chạy qua.

## P4. Mở rộng

**Phạm vi**

- Model: `RecurringSeries`, `Reminder`, `Notification`; token lịch.
- Việc lặp (BR-70 … BR-74), nhắc hạn trong ứng dụng + Web Push (BR-90 … BR-92) với Vercel Cron.
- Xuất CSV; lịch `.ics` đăng ký được.
- Tác vụ dọn thùng rác sau 30 ngày (BR-12).

**Xong khi**

- [ ] US-50 … US-53 đạt tiêu chí chấp nhận.
- [ ] TC-44 … TC-48 chạy qua; có test tích hợp cho cron nhắc hạn.
- [ ] File `.ics` nhập được vào Google Calendar (kiểm thủ công).

## P5. Hoàn thiện

**Phạm vi**

- PWA: manifest, biểu tượng, service worker cho chế độ chỉ đọc khi mất mạng (US-54).
- Kiểm tra NFR-01 … NFR-06; sửa các điểm chậm.
- Nút "Hiện thêm" cho cột trên 100 thẻ để bảng 500 việc đạt NFR-03.
- Giới hạn tần suất cho API ghi `/api/v1/*`: 120 lần/phút/người dùng, bộ đếm dùng chung giữa các instance serverless (NFR-11 (b)).
- Rà soát khả năng truy cập toàn bộ (mục 5 file 09).

**Xong khi**

- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95 cho Hôm nay và trang dự án.
- [ ] Không còn lỗi axe mức "serious".
- [ ] Vượt 120 lần ghi/phút trả `429 RATE_LIMITED` (có test tích hợp).

## Ngoài lộ trình hiện tại

Cộng tác nhiều người, ứng dụng native, AI xếp lịch, thanh toán, đồng bộ hai chiều Google Calendar, nhập dữ liệu từ cổng đào tạo. Khi được yêu cầu, xác nhận lại phạm vi và cập nhật file 01 trước khi làm.
