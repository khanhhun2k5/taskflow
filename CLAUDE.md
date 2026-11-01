# CLAUDE.md — TaskFlow

> Ứng dụng web quản lý công việc cá nhân cho sinh viên và người làm việc độc lập: môn học, lịch trình hằng ngày, dự án, bảng Kanban/Scrum.
> File này là **quy tắc làm việc**. Chi tiết nằm trong `docs/` — đọc file liên quan trước khi sửa code.

## 1. Đọc gì trước khi làm

| Khi làm | Đọc |
|---|---|
| Bất kỳ tính năng nào | `docs/02-functional-spec.md` (quy tắc `BR-xx`) |
| Khởi tạo, thêm thư viện, đặt file ở đâu | `docs/03-architecture.md` |
| Sửa `prisma/schema.prisma` | `docs/04-data-model.md` |
| Viết hoặc gọi API | `docs/05-api-spec.md` |
| Giao diện | `docs/06-ui-ux-spec.md` |
| Tiến độ, burndown, velocity, điểm môn | `docs/07-progress-metrics.md` |
| Viết test | `docs/09-testing-strategy.md` |
| Không chắc phạm vi giai đoạn | `docs/10-roadmap.md` |

Ràng buộc chung về hiệu năng, bảo mật, múi giờ, truy cập: `docs/08-non-functional.md`.

## 2. Ý tưởng cốt lõi

- **Mọi thứ là `Task`.** Bài tập, việc trong ngày, hạng mục dự án đều là `Task`. Môn học, dự án, lịch chỉ là cách nhóm và hiển thị. Không tạo bảng riêng cho "bài tập".
- `Task.statusCategory` (`TODO` | `IN_PROGRESS` | `DONE`) là nguồn cho mọi phép tính tiến độ. Việc trên bảng luôn có `statusCategory` bằng nhóm trạng thái của cột chứa nó — chỉ đổi qua `moveTask` / `updateColumn` (ADR-03).
- Mỗi tài khoản là một người dùng; **mọi** truy vấn lọc theo `userId` của phiên.

## 3. Công nghệ (đã chốt — hỏi trước khi đổi)

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui · next-themes · lucide-react · @dnd-kit · date-fns 4 + @date-fns/tz · Recharts · react-hook-form + @hookform/resolvers + Zod 4 · TanStack Query 5 + @tanstack/react-virtual · Prisma 7 · PostgreSQL 17 (mọi môi trường, Docker khi dev) · Better Auth · next-intl · fractional-indexing · react-markdown (cấm `rehype-raw`) · Vitest + @testing-library/react + @testing-library/user-event + jsdom · Playwright + @axe-core/playwright · ESLint + Prettier.

Lý do từng lựa chọn: `docs/03-architecture.md` mục 2 (ADR).

## 4. Lệnh

```bash
docker compose up -d db
npm install
npm run env:init          # tạo .env lần đầu
npx prisma migrate dev
npx prisma db seed
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Trước khi báo "xong": `lint`, `typecheck`, `test` phải qua. Đổi giao diện luồng chính thì chạy thêm `test:e2e` liên quan.

## 5. Quy tắc kiến trúc

- Logic nghiệp vụ là **hàm thuần** trong `src/features/*/domain/`: không import React, Prisma, Next; không gọi `new Date()` bên trong — nhận `now` qua tham số.
- Route Handler `/api/v1/*` chỉ: lấy phiên (`withUser`) → kiểm tra đầu vào (Zod) → gọi `src/server/services/*`.
- Component không import Prisma hay `src/server/`; gọi API qua hook trong `src/features/*/hooks.ts`.
- Không dùng Server Actions cho dữ liệu nghiệp vụ (ADR-06).
- Thao tác nhiều bước chạy trong một giao dịch DB.

## 6. Quy ước code

- Cấm `any`; dùng `unknown` rồi thu hẹp kiểu. Kiểu suy ra từ schema Zod (`z.infer`).
- Tên biến, hàm, file, comment kỹ thuật bằng tiếng Anh. Chuỗi hiển thị chỉ nằm trong `messages/vi.json` và `messages/en.json`.
- Code thực hiện một quy tắc nghiệp vụ ghi mã trong comment: `// BR-30`.
- Thời điểm lưu UTC; "hôm nay" tính theo `User.timezone`. Dùng `src/lib/dates.ts`, không so sánh ngày bằng chuỗi.
- Thứ tự trong cột/backlog: khóa chuỗi qua `src/lib/ordering.ts`.
- Kéo thả cập nhật lạc quan; lỗi thì hoàn tác và báo người dùng.
- Component ≤ 150 dòng.
- Commit theo Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Không thêm thư viện ngoài danh sách mục 3 khi chưa hỏi; nếu đề xuất, nêu lý do.

## 7. Cách làm việc

- **Hiểu trước, viết sau.** Với yêu cầu lớn, tóm tắt kế hoạch (file sẽ đụng, `BR`/`TC` liên quan) rồi mới sửa.
- Chỉ làm giai đoạn đang được yêu cầu (`docs/10-roadmap.md`). Mỗi lần một việc; không tiện tay sửa phần không liên quan.
- Đổi `schema.prisma`: tạo migration (ràng buộc viết tay theo `docs/04` mục 3) và cập nhật `docs/04-data-model.md`.
- Đổi một quyết định đã chốt: cập nhật file docs liên quan và thêm ADR mới trong `docs/03`.
- Yêu cầu mơ hồ về nghiệp vụ mà docs chưa trả lời: **hỏi lại**, không tự đoán. Sau khi có câu trả lời, ghi vào docs.
- Dữ liệu mẫu chỉ nằm trong `prisma/seed.ts`.
- Không xóa file, không chạy `migrate reset`/`drop` khi chưa được cho phép.
- Không commit bí mật; chỉ có `.env.example`.
- Báo kết quả ngắn: đã làm gì, đã chạy kiểm tra nào, còn điều gì chưa chắc.

## 8. Ngoài phạm vi

Cộng tác nhiều người, ứng dụng native, AI xếp lịch, thanh toán, đồng bộ hai chiều Google Calendar. Gặp yêu cầu này thì xác nhận phạm vi trước.
