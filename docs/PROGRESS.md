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
| b | API và tầng dịch vụ | Chưa bắt đầu |

**Ghi chú cho phần b:** `Task.estimate` trong DB là `Decimal`, hàm thuần nhận `number`. Đổi kiểu ở tầng dịch vụ, không làm trong domain. TC-20…22 hiện mới kiểm ở mức hàm thuần; mã lỗi HTTP (`409 WIP_LIMIT_EXCEEDED`, `warnings`) kiểm ở phần b.

## Việc tiếp theo

**MVP-1 phần b** sau khi phần a được duyệt và merge.

## Câu hỏi còn mở

Ghi kết quả vào docs liên quan sau khi có câu trả lời.

1. **Đổi `User.timezone` thì hạn cả ngày có quy đổi không?** Hạn cả ngày lưu 00:00 theo múi giờ cũ (NFR-32). Sau khi đổi múi giờ, việc có thể bị báo trễ sớm hoặc muộn một ngày. Cần quyết định trước khi làm `PATCH /api/v1/me` đổi múi giờ hoặc trang Hôm nay đầy đủ (MVP-2).
2. **Rate limit tin header `x-forwarded-for` (NFR-11).** Chỉ an toàn khi chạy sau proxy ghi đè header (ví dụ Vercel). Cần ghi rõ ràng buộc triển khai trong file 08, hoặc cấu hình `trustedProxies`.
3. **Giới hạn 150 dòng cho component.** Có miễn cho file shadcn sinh ra trong `src/components/ui/*` không? (`dropdown-menu.tsx` dài 249 dòng.)
