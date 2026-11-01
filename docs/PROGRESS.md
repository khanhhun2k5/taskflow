# Tiến độ

Trạng thái hiện tại của dự án. Cập nhật khi xong một phần hoặc một giai đoạn; tiêu chí "xong" nằm ở [10-roadmap.md](10-roadmap.md).

_Cập nhật: 2026-11-01._

## Tổng quan

| Giai đoạn | Trạng thái |
|---|---|
| P0. Nền móng | ✅ Hoàn tất |
| MVP-1. Việc, dự án, Kanban | 🚧 Đang làm (phần a) |
| MVP-2. Môn học và lịch trình | Chưa bắt đầu |
| MVP-3. Scrum | Chưa bắt đầu |
| P4. Mở rộng | Chưa bắt đầu |
| P5. Hoàn thiện | Chưa bắt đầu |

## P0. Nền móng — hoàn tất

| Phần | Nội dung | Commit |
|---|---|---|
| a | Khởi tạo Next.js 16, Tailwind 4, shadcn/ui, ESLint, Prettier, Vitest, Playwright | `f764581` … `59131c5` |
| b | Prisma 7 + migration xác thực, Better Auth (email, Google tùy chọn, rate limit), `src/proxy.ts`, `withUser`, `/api/v1/me` | `2fd3dd6`, `3f94e9e` |
| c | next-intl (vi/en theo `User.locale`), sáng/tối (`next-themes`, ADR-13), bố cục responsive, trang Hôm nay trống, `src/lib/dates.ts`, GitHub Actions, README | PR #1 (`dc3cc95`) |

Checklist "Xong khi" của P0 trong file 10: đạt cả 4 mục.

- US-01, US-02, US-03: test tích hợp `auth.test.ts`, `me.test.ts`; E2E `auth.spec.ts`.
- TC-90 (phần P0): `npm run test:e2e`, 11/11 qua, có axe ở chế độ sáng và tối.
- CI xanh trên pull request: PR #1.
- `.env.example` đầy đủ; README chạy từ đầu trong 5 lệnh.

## MVP-1. Việc, dự án, Kanban — đang làm

| Phần | Nội dung | Trạng thái |
|---|---|---|
| a | Tầng dữ liệu (7 model, migration `mvp1_tasks_kanban` + SQL viết tay) và hàm thuần (`ordering.ts`, `progress.ts`, `wip.ts`); TC-01…07, TC-20…25 dạng hàm/tích hợp | Nhánh `mvp1-tasks-kanban`, chưa commit |
| b | Tầng dịch vụ (`tasks`, `projects`, `boards`, `labels`) + 16 Route Handler; TC-12…17, TC-20…23, TC-21b ở mức HTTP; `assertInvariants` sau mỗi thao tác ghi | Nhánh `mvp1-tasks-kanban`, chưa commit |
| c1 | Nền giao diện: TanStack Query + `api-client`, cập nhật lạc quan + toast "Thử lại", Hộp thư, danh sách dự án, trang dự án (cột tĩnh), `TaskDialog`, `QuickAdd`, Thùng rác, thanh bên có dự án thật; `P2034` tự thử lại → `409 CONFLICT` | Nhánh `mvp1-tasks-kanban`, chưa commit |
| c2 | `KanbanBoard` kéo thả (chuột, cảm ứng, bàn phím), menu cột, `ListView` (lọc trong URL, sắp xếp, cuộn vô tận, danh sách ảo, sửa hàng loạt), tab kiểu xem, phím tắt, dự án lưu trữ chỉ đọc, seed; TC-91, TC-92 | Nhánh `mvp1-tasks-kanban`, chưa commit |

**Đã xử lý ở phần b:** đổi `Decimal → number` tại tầng dịch vụ (`decimalToNumber` trong `src/server/services/task-dto.ts`); TC-20…23 và TC-21b (đồng thời) kiểm ở mức HTTP (`tests/integration/wip-http.test.ts`).

**Nợ kỹ thuật ghi nhận khi review phần b** (chưa ảnh hưởng đúng/sai, xem lại khi dữ liệu lớn):

- `GET /tasks?q=` lấy toàn bộ id khớp tiêu đề rồi lọc `id IN (…)`; nên đưa điều kiện `f_unaccent` vào chính truy vấn danh sách.
- `GET /trash` nạp mọi mục đã xóa vào bộ nhớ rồi mới phân trang; trước P4 thùng rác không tự dọn (BR-12).
- Độ phủ 90% (NFR-61) chỉ đo `features/*/domain` và `lib`; tầng dịch vụ và route được kiểm bằng test tích hợp, không có số đo độ phủ.

## Việc tiếp theo

**NFR-03 — tiêu chí mới (docs/08, sửa 2026-11-01).** Thay "trung bình ≥ 50 fps" bằng p95 khung hình ≤ 20 ms và long task dài nhất ≤ 100 ms (bảng ≤ 100 việc) / ≤ 300 ms (bảng 500 việc), vì trung bình fps bị vài long task lúc nhặt/thả kéo xuống và không phản ánh độ mượt khi kéo. **Kết quả:** bảng 100 việc **đạt**; bảng 500 việc **chưa đạt — đã chấp nhận chuyển sang P5** (mục "Hiện thêm" cho cột > 100 thẻ trong docs/10). Đã dừng tối ưu tại đây.

Cách đo (giữ nguyên qua mọi lần): Playwright + React Profiler trên bản build `next build --profile`, dữ liệu `npm run db:seed:large` / `npm run db:seed:large -- 100` tạo lại trước mỗi lần, mở bảng rồi kéo thẻ đầu tiên của "Cần làm" sang "Đang làm" bằng chuột; CPU thường, máy dev.

| CPU thường | 500 việc: p95 khung hình / long task dài nhất / fps TB | 100 việc: p95 / long task dài nhất / fps TB |
|---|---|---|
| Trước tối ưu (`151d301`) | 167 ms / 1,1 s / 25 | 17 ms / 115 ms / 54 |
| Sau commit perf `c07c2cc` — lần đo 1 | 17 ms / 238 ms / 45 | 17 ms / 57 ms / 58 |
| Sau commit perf — lần đo A/B (2 lần) | 33 ms / 312–372 ms / 39–40 | 17 ms / 72–85 ms / 56–58 |
| Thử `content-visibility: auto` (A/B, 2 lần) | 33 ms / 312–316 ms / 41–42 | 17 ms / 92–103 ms / 55–56 |
| **Tiêu chí** | **≤ 20 ms / ≤ 300 ms** | **≤ 20 ms / ≤ 100 ms** |

Hai dòng "sau" khác nhau do tải máy lúc đo (cùng một code); bảng 500 việc sát hoặc vượt ngưỡng tùy lần đo, nên ghi là chưa đạt.

**`content-visibility: auto` đã thử và bỏ.** Không cải thiện đo được (chênh lệch nằm trong nhiễu, bảng 100 việc có lần long task 103 ms > 100 ms), và cần thêm `shrink-0` cho thẻ: nếu thiếu, thẻ bị ép về 0 px trong cột flex, làm sai chiều cao cuộn và vị trí thả. Không làm sai vị trí thả khi đã có `shrink-0`, nhưng không đáng thêm. E2E `tests/e2e/long-column.spec.ts` (cột 250 thẻ, cuộn xuống cuối rồi thả giữa hai thẻ đang hiện, giữa cột và cuối cột; kiểm trên server, giao diện và sau khi tải lại) được giữ lại. Khi viết test này thấy: dnd-kit tự cuộn cột khi con trỏ ở gần mép trên/dưới, thẻ rơi đúng chỗ dưới con trỏ sau khi cuộn — đúng hành vi, test nhắm vào giữa vùng đang hiện.

**Phương án dự phòng cho bảng 500 việc (chưa làm):**
1. Ảo hóa cột (chỉ render thẻ trong vùng nhìn). Cần giải quyết xung đột với vùng thả của `SortableContext` (thẻ ngoài vùng nhìn không có trong DOM nên không đo được), ví dụ dùng cột làm vùng thả và tự tính vị trí theo chỉ số.
2. "Hiện thêm" cho cột > 100 thẻ: mặc định render 100 thẻ đầu, nút "Hiện thêm" tải tiếp; đơn giản hơn ảo hóa, đổi lại người dùng phải bấm để thả xuống sâu trong cột.

**Việc tiếp theo:** thử kéo bằng cảm ứng trên điện thoại (US-15), rồi mở PR MVP-1. NFR-03 cho bảng 500 việc làm ở P5.

**Ghi chú kỹ thuật c2:** `KeyboardSensor` của dnd-kit chỉ bắt phím sau một `setTimeout` kể từ lúc nhặt, nên phím bấm ngay sau Space có thể mất (E2E TC-92 bấm lại khi bị mất). Lỗi thật đã sửa: dữ liệu bảng tải lại giữa lúc kéo làm mất nước đi bằng bàn phím → bảng được "đóng băng" trong lúc kéo.

## Câu hỏi còn mở

Ghi kết quả vào docs liên quan sau khi có câu trả lời.

1. **Đổi `User.timezone` thì hạn cả ngày có quy đổi không?** Hạn cả ngày lưu 00:00 theo múi giờ cũ (NFR-32). Sau khi đổi múi giờ, việc có thể bị báo trễ sớm hoặc muộn một ngày. Cần quyết định trước khi làm `PATCH /api/v1/me` đổi múi giờ hoặc trang Hôm nay đầy đủ (MVP-2).
2. **Rate limit tin header `x-forwarded-for` (NFR-11).** Chỉ an toàn khi chạy sau proxy ghi đè header (ví dụ Vercel). Cần ghi rõ ràng buộc triển khai trong file 08, hoặc cấu hình `trustedProxies`.
3. **Giới hạn 150 dòng cho component.** Có miễn cho file shadcn sinh ra trong `src/components/ui/*` không? (`dropdown-menu.tsx` dài 249 dòng.)
