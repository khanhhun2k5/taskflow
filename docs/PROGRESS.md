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

**NFR-03 (500 việc) vẫn chưa đạt sau tối ưu** — tiêu chí: CPU thường, trung bình ≥ 50 fps khi kéo. Đo 2026-11-01 bằng Playwright + React Profiler (bản build `next build --profile`, `npm run db:seed:large` và `npm run db:seed:large -- 100`), máy dev, cùng một kịch bản: mở bảng, kéo thẻ đầu tiên của "Cần làm" sang "Đang làm" bằng chuột. "Trước" = commit `151d301`, "sau" = commit perf (memo + props ổn định, `DragOverlay`, đo mặc định khi đang kéo, ghi `TaskDTO` của `/move` vào cache thay vì tải lại bảng).

| Chỉ số (CPU thường) | 500 việc trước | 500 việc sau | 100 việc trước | 100 việc sau |
|---|---|---|---|---|
| **Khung hình khi kéo, trung bình** | 25 fps | **45 fps** ❌ | 54 fps | **58 fps** ✅ |
| Khung hình p95 / tệ nhất | 167 ms / 1,2 s | 17 ms / 250 ms | 17 ms / 100 ms | 17 ms / 50 ms |
| Long task khi kéo (số / dài nhất) | 12 / 1,1 s | 4 / 238 ms | 4 / 115 ms | 1 / 57 ms |
| React commit (trung vị / lớn nhất / tổng) | 9,9 / 253 / 2954 ms | 4,2 / 69 / 727 ms | 1,4 / 24 / 378 ms | 1,1 / 17 / 183 ms |
| Thả → commit cuối cùng | 2,1 s | 0,54 s | 0,34 s | 0,28 s |
| Thẻ đầu tiên hiện sau khi mở trang | 1,5 s | 1,0 s | 0,48 s | 0,44 s |

Tham khảo, CPU chậm ×4 (trung bình fps / long task dài nhất): 500 việc 4 → 15 fps / 7,8 → 2,0 s; 100 việc 26 → 35 fps / 1,2 → 0,6 s.

Phần còn chậm ở 500 việc là vài long task (≈ 0,2 s) lúc nhặt thẻ và khi thẻ vào/ra cột 250 thẻ: dnd-kit đo lại vị trí mọi thẻ khi bắt đầu kéo, và mọi thẻ trong cột dùng `useSortable` render lại mỗi khi thứ tự trong `SortableContext` đổi (`memo` không chặn được vì đó là context). Bước tiếp đề xuất (chưa làm):

1. `content-visibility: auto` + `contain-intrinsic-size` cho thẻ: trình duyệt bỏ qua layout/paint của thẻ ngoài màn hình, không đổi cây React nên không xung đột vùng thả.
2. Tách phần `useSortable` khỏi phần hiển thị sâu hơn (thẻ ngoài vùng nhìn chỉ render khung tối thiểu), và đo lại sau bước 1.
3. Nếu vẫn chưa đạt: ảo hóa cột (đề xuất c, đang hoãn vì xung đột vùng thả của sortable) hoặc "Hiện thêm" cho cột > 100 thẻ.

**Việc tiếp theo:** quyết định bước tiếp cho NFR-03, thử kéo bằng cảm ứng trên điện thoại (US-15), rồi mở PR MVP-1.

**Ghi chú kỹ thuật c2:** `KeyboardSensor` của dnd-kit chỉ bắt phím sau một `setTimeout` kể từ lúc nhặt, nên phím bấm ngay sau Space có thể mất (E2E TC-92 bấm lại khi bị mất). Lỗi thật đã sửa: dữ liệu bảng tải lại giữa lúc kéo làm mất nước đi bằng bàn phím → bảng được "đóng băng" trong lúc kéo.

## Câu hỏi còn mở

Ghi kết quả vào docs liên quan sau khi có câu trả lời.

1. **Đổi `User.timezone` thì hạn cả ngày có quy đổi không?** Hạn cả ngày lưu 00:00 theo múi giờ cũ (NFR-32). Sau khi đổi múi giờ, việc có thể bị báo trễ sớm hoặc muộn một ngày. Cần quyết định trước khi làm `PATCH /api/v1/me` đổi múi giờ hoặc trang Hôm nay đầy đủ (MVP-2).
2. **Rate limit tin header `x-forwarded-for` (NFR-11).** Chỉ an toàn khi chạy sau proxy ghi đè header (ví dụ Vercel). Cần ghi rõ ràng buộc triển khai trong file 08, hoặc cấu hình `trustedProxies`.
3. **Giới hạn 150 dòng cho component.** Có miễn cho file shadcn sinh ra trong `src/components/ui/*` không? (`dropdown-menu.tsx` dài 249 dòng.)
