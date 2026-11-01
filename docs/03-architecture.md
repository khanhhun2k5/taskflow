# 03. Kiến trúc và công nghệ

## 1. Công nghệ đã chốt

Phiên bản ghi theo **số chính** (major). Khi khởi tạo, cài bản ổn định mới nhất của số chính đó và ghi phiên bản chính xác vào `package.json`. Không tự nâng số chính khi chưa được đồng ý.

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Ngôn ngữ | TypeScript 5, chế độ `strict` | Toàn bộ dự án |
| Khung ứng dụng | Next.js 16 (App Router) + React 19 | Giao diện, định tuyến, API |
| Giao diện | Tailwind CSS 4 + shadcn/ui (Radix) | Thành phần giao diện có sẵn khả năng truy cập |
| Biểu tượng | lucide-react | Bộ biểu tượng mặc định của shadcn/ui |
| Kéo thả | @dnd-kit/core, @dnd-kit/sortable | Kanban, backlog, cột, lưới giờ; hỗ trợ bàn phím |
| Xử lý ngày giờ | date-fns 4 + @date-fns/tz | Tính toán ngày, múi giờ |
| Biểu đồ | Recharts | Burndown, velocity |
| Form | react-hook-form + @hookform/resolvers (`zodResolver`) | Nối schema Zod vào form |
| Kiểm tra dữ liệu | Zod 4 | Dùng chung cho form, API, biến môi trường |
| Dữ liệu phía client | TanStack Query 5 | Bộ nhớ đệm, cập nhật lạc quan |
| Danh sách ảo | @tanstack/react-virtual | `ListView` > 100 dòng (file 06 mục 4.5) |
| Hiển thị Markdown | react-markdown | Mô tả việc; **không** dùng `rehype-raw` hay cho phép HTML thô (NFR-14) |
| ORM | Prisma 7 | Truy cập DB, migration |
| Cơ sở dữ liệu | PostgreSQL 17 (mọi môi trường) | |
| Xác thực | Better Auth | Email + mật khẩu, Google OAuth, phiên lưu trong DB |
| Đa ngôn ngữ | next-intl | Tiếng Việt mặc định, tiếng Anh |
| Thứ tự sắp xếp | fractional-indexing | Khóa sắp xếp dạng chuỗi (ADR-05) |
| Kiểm thử đơn vị/thành phần | Vitest + @testing-library/react + @testing-library/user-event + jsdom | Hàm thuần, schema, component |
| Kiểm thử đầu-cuối | Playwright + @axe-core/playwright | Luồng chính + kiểm tra truy cập (file 09 mục 5) |
| Chất lượng mã | ESLint (cấu hình Next), prettier | |
| Môi trường dev | Docker Compose (PostgreSQL) | |
| Triển khai | Vercel + PostgreSQL có quản lý (Neon hoặc Supabase) | |
| CI | GitHub Actions | lint, typecheck, test, build, e2e |

Trình quản lý gói: **npm** (giữ đồng nhất với `CLAUDE.md`). Node.js ≥ 22 LTS.

## 2. Quyết định kiến trúc (ADR)

Mỗi quyết định ghi: bối cảnh, lựa chọn, lý do, hệ quả.

### ADR-01. Ứng dụng web responsive, một codebase Next.js

- **Bối cảnh**: cần chạy trên máy tính và điện thoại; một người phát triển.
- **Lựa chọn**: Next.js App Router làm cả giao diện lẫn API. Sau này thêm PWA.
- **Lý do**: không phải duy trì hai dự án; triển khai một lần.
- **Hệ quả**: không có ứng dụng native; thông báo đẩy dùng Web Push.

### ADR-02. PostgreSQL cho mọi môi trường (bỏ SQLite)

- **Bối cảnh**: bản CLAUDE.md đầu đề xuất SQLite khi dev.
- **Lựa chọn**: PostgreSQL ở cả dev (Docker), test và production.
- **Lý do**: SQLite khác PostgreSQL ở enum, mảng, so khớp không phân biệt dấu (`unaccent`), kiểu thời gian. Dev bằng SQLite sẽ che lỗi chỉ lộ ra ở production.
- **Hệ quả**: cần Docker khi dev. Lệnh `docker compose up -d db`.

### ADR-03. Lưu `statusCategory` trực tiếp trên `Task`

- **Bối cảnh**: bản đầu định suy trạng thái từ cột. Nhưng việc lẻ (Hộp thư) không có cột, và mọi truy vấn tiến độ phải nối bảng cột.
- **Lựa chọn**: `Task.statusCategory` là cột thật. Với việc trên bảng, nó luôn bằng nhóm trạng thái của cột (BR-01), cập nhật trong cùng giao dịch.
- **Lý do**: truy vấn "việc trễ hạn", "tiến độ" đơn giản và nhanh; việc lẻ vẫn có trạng thái.
- **Hệ quả**: phải giữ hai giá trị đồng bộ. Mọi thao tác đổi cột hoặc đổi nhóm trạng thái của cột đi qua **một** hàm dịch vụ (`moveTask`, `updateColumn`) và có test (TC-12).

### ADR-04. Bảng thuộc dự án hoặc môn học

- **Lựa chọn**: `Board` có `projectId?` hoặc `courseId?` (đúng một trong hai, ràng buộc CHECK).
- **Lý do**: môn học cũng cần xem Kanban bài tập (BR-23) mà không phải tạo dự án giả.

### ADR-05. Khóa sắp xếp dạng chuỗi (fractional indexing)

- **Bối cảnh**: bản đầu dùng số thực. Chèn liên tục vào cùng một chỗ sau khoảng 50 lần sẽ hết độ chính xác của số thực.
- **Lựa chọn**: thư viện `fractional-indexing`, khóa là chuỗi (ví dụ `"a0"`, `"a0V"`), so sánh theo thứ tự chuỗi.
- **Hệ quả**: cột `order` kiểu `String`. Để so sánh theo byte, collation `"C"` được đặt **ngay trên cột** trong migration (`Task.order`, `Task.backlogOrder`, `Column.order`, `GradeComponent.order`; SQL ở file 04 mục 3). Nhờ vậy Prisma `orderBy` dùng bình thường, không cần `ORDER BY … COLLATE` trong SQL thô. TC-25 kiểm tra thứ tự DB khớp với so sánh chuỗi trong JS.
- **Sửa đổi**: bản trước ghi `ORDER BY "order" COLLATE "C"` trong truy vấn; đổi vì Prisma `orderBy` không chỉ định được collation.

### ADR-06. API dạng REST qua Route Handlers + TanStack Query

- **Bối cảnh**: Kanban và lịch cần cập nhật lạc quan và hoàn tác — việc này cần bộ nhớ đệm phía client.
- **Lựa chọn**:
  - Đọc lần đầu: Server Component lấy dữ liệu qua tầng dịch vụ, truyền sẵn vào bộ nhớ đệm của TanStack Query (`HydrationBoundary`).
  - Đọc và ghi sau đó: client gọi `/api/v1/*` (Route Handlers) bằng TanStack Query.
  - Không dùng Server Actions cho dữ liệu nghiệp vụ.
- **Lý do**: một kiểu gọi duy nhất, dễ kiểm thử, có hợp đồng API rõ (file 05), sau này dùng lại được cho ứng dụng khác.

### ADR-07. Xác thực bằng Better Auth, có ngay từ giai đoạn 0

- **Bối cảnh**: bản đầu để đăng nhập ở giai đoạn sau.
- **Lựa chọn**: làm xác thực trước MVP-1; mọi bảng nghiệp vụ có `userId`.
- **Lý do**: thêm `userId` vào dữ liệu đã có sau này rất tốn công và dễ sót chỗ kiểm tra quyền. Better Auth chạy trong ứng dụng, lưu dữ liệu vào chính PostgreSQL qua Prisma, không phụ thuộc dịch vụ trả phí.
- **Hệ quả**: mỗi hàm dịch vụ nhận `userId` làm tham số đầu tiên.

### ADR-08. Logic nghiệp vụ là hàm thuần

- **Lựa chọn**: tính tiến độ, burndown, velocity, sinh buổi học, sinh lần lặp, điểm dự kiến, kiểm tra WIP đặt trong `src/features/*/domain/` dưới dạng hàm thuần (đầu vào → đầu ra, không đọc DB, không đọc giờ hệ thống).
- **Lý do**: test nhanh, không cần DB; thời điểm hiện tại truyền vào bằng tham số `now` để test được.

### ADR-09. Lặp lại sinh theo yêu cầu, không dùng tác vụ định kỳ

- **Lựa chọn**: lần xuất hiện của việc lặp được tạo khi người dùng mở khung nhìn chứa nó hoặc khi hoàn thành lần trước (BR-72), idempotent nhờ ràng buộc duy nhất.
- **Lý do**: Vercel gói miễn phí giới hạn cron; cách này không cần máy chạy nền.
- **Hệ quả**: lời nhắc (BR-90) vẫn cần một cron (Vercel Cron mỗi 5 phút) ở giai đoạn P4.

### ADR-10. Burndown dựng lại từ nhật ký

- **Lựa chọn**: không lưu điểm còn lại mỗi ngày. Hàm thuần `computeBurndown(events, sprint, tz)` dựng lại từ `ActivityLog` (BR-95). Khi kết thúc sprint, lưu kết quả vào `Sprint.burndownSnapshot` (BR-46).
- **Lý do**: không cần cron chụp số liệu hằng ngày; vẫn đúng khi phạm vi thay đổi giữa sprint.

### ADR-11. Chặn route hai lớp: kiểm tra cookie ở rìa, kiểm tra phiên đầy đủ ở server

- **Bối cảnh**: Next.js 16 có file chạy trước mọi request để chuyển hướng (các bản trước gọi là `middleware.ts`). Kiểm tra phiên đầy đủ ở đó cần truy vấn DB cho mọi request, kể cả tài nguyên tĩnh.
- **Lựa chọn**:
  - **Tên file** theo tài liệu chính thức của Next.js 16 tại thời điểm khởi tạo. Khi tạo file, tra cứu tài liệu Next.js và ghi đường dẫn nguồn vào comment đầu file và vào mục này.
    → **`src/proxy.ts`**, export hàm `proxy`. Next.js 16 đã đổi `middleware` thành `proxy` (`middleware` bị đánh dấu deprecated). Nguồn: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (next@16.4.3), https://nextjs.org/docs/app/api-reference/file-conventions/proxy, tra ngày 2026-11-01.
  - Kiểm tra cookie bằng helper `getSessionCookie` của `better-auth/cookies`, không viết cứng tên cookie (production có tiền tố `__Secure-`, helper tự xử lý).
  - File đó **chỉ** kiểm tra có cookie phiên của Better Auth hay không: không có thì chuyển hướng tới `/login`. Không đọc DB, không giải mã phiên.
  - Kiểm tra phiên **đầy đủ** (phiên còn hạn, người dùng tồn tại) ở hai chỗ: layout của nhóm `(app)` (chuyển hướng về `/login` nếu không hợp lệ) và `withUser` trong `src/server/http.ts` (trả `401`).
- **Lý do**: cookie có thể hết hạn hoặc bị giả; chỉ kiểm tra ở rìa thì không an toàn, chỉ kiểm tra ở layout thì chậm chuyển hướng. Hai lớp cho cả trải nghiệm nhanh lẫn an toàn.
- **Hệ quả**: không bao giờ dựa vào file chặn ở rìa để phân quyền dữ liệu; mọi Route Handler vẫn phải đi qua `withUser` (NFR-10).

### ADR-12. Giữ `cacheComponents` và `partialPrefetching` của Next.js 16

- **Bối cảnh**: khi khởi tạo dự án (P0), `create-next-app@16.4.3` bật sẵn `cacheComponents: true` và `partialPrefetching: true` trong `next.config.ts`. Hai cờ này đổi cách render: phần không phụ thuộc request được prerender thành khung tĩnh, phần đọc dữ liệu lúc request được stream sau. Các ADR trước được viết khi chưa tính đến chế độ này.
- **Lựa chọn**: giữ cả hai cờ như mặc định của công cụ khởi tạo.
- **Lý do**:
  - Đây là mặc định chính thức của Next.js 16.4; tắt đi nghĩa là đi ngược hướng phát triển của framework, và tài liệu mới viết cho chế độ này.
  - Khung trang (thanh bên, điều hướng dưới, tiêu đề) hiện ngay từ bản prerender, phần dữ liệu của người dùng stream vào sau — điều hướng nhanh hơn.
  - `partialPrefetching` cho `<Link>` tải trước khung chung của route một lần thay vì từng liên kết; chỉ hoạt động khi `cacheComponents` bật.
  - Dữ liệu nghiệp vụ vẫn đọc/ghi qua TanStack Query và `/api/v1/*` (ADR-06), nên phần lớn logic không phụ thuộc vào cơ chế cache phía server.
- **Hệ quả**:
  - **Mọi chỗ đọc `cookies()` hoặc `headers()` trong Server Component hoặc layout phải nằm trong `<Suspense>` có fallback dạng khung xương (skeleton)**, kể cả kiểm tra phiên đầy đủ ở layout nhóm `(app)` theo ADR-11. Cụ thể: layout `(app)` render khung tĩnh (thanh bên, điều hướng) ngay; thành phần kiểm tra phiên và nội dung trang nằm trong `<Suspense>`; phiên không hợp lệ thì chuyển hướng về `/login` từ bên trong ranh giới đó. Thiếu `<Suspense>` thì dev overlay của Next.js báo "blocking route" và trang bị chặn render tới khi đọc xong.
  - Áp dụng tương tự cho Server Component lấy dữ liệu lần đầu để đổ vào `HydrationBoundary` (ADR-06) vì chúng cần `userId` từ phiên.
  - Fallback khung xương phải giữ đúng kích thước bố cục để tránh nhảy giao diện (file 06).
  - Không dùng `"use cache"` hay `"use cache: remote"` cho dữ liệu theo người dùng mà không truyền `userId` làm tham số; dữ liệu đọc thẳng từ cookie chỉ được cache bằng `"use cache: private"`. Hiện tại chưa dùng các chỉ thị cache; thêm vào thì phải ghi ADR.
  - Route Handler `/api/v1/*` và file chặn route ở rìa (ADR-11) không bị ảnh hưởng.
  - Nếu một route chưa kịp tách `<Suspense>`, tạm đặt `export const instant = false` trên page/layout đó và ghi TODO; không tắt `cacheComponents` toàn cục khi chưa có ADR mới.
- **Nguồn** (tài liệu đi kèm `next@16.4.3`, `node_modules/next/dist/docs/`, tra ngày 2026-11-01):
  - `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` — https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
  - `01-app/01-getting-started/08-caching.md` (mục "Streaming uncached data", runtime API `cookies`/`headers` cần `<Suspense>`) — https://nextjs.org/docs/app/getting-started/caching
  - `01-app/02-guides/authentication-with-cache-components.md` (đọc phiên lúc request luôn nằm sau `<Suspense>`; `instant = false` khi chuyển đổi dần) — https://nextjs.org/docs/app/guides/authentication-with-cache-components
  - `01-app/02-guides/adopting-partial-prefetching.md` — https://nextjs.org/docs/app/guides/adopting-partial-prefetching

## 3. Sơ đồ tầng

```
Trình duyệt
  └─ React Client Components ── TanStack Query ──┐
                                                   │ HTTP JSON
Next.js server                                     ▼
  ├─ Server Components (đọc lần đầu) ──┐   Route Handlers /api/v1/*
  │                                     │     ├─ xác thực phiên (Better Auth)
  │                                     │     ├─ kiểm tra đầu vào (Zod)
  │                                     ▼     ▼
  │                              Tầng dịch vụ  src/server/services/*
  │                                ├─ gọi hàm thuần  src/features/*/domain/*
  │                                └─ Prisma ── PostgreSQL
```

Quy tắc phụ thuộc (không được vi phạm):

- `features/*/domain` **không** import React, Prisma, Next, hay `server/`.
- `server/services` không import React hay component.
- `components` không import Prisma hay `server/`; chỉ gọi API qua hook trong `features/*/hooks`.
- Route Handler chỉ làm 3 việc: lấy phiên, kiểm tra đầu vào, gọi dịch vụ. Không chứa logic nghiệp vụ.

## 4. Cấu trúc thư mục

```
.
├─ CLAUDE.md
├─ docs/                         # bộ đặc tả này
├─ docker-compose.yml            # PostgreSQL dev
├─ .env.example
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                    # dữ liệu mẫu, chỉ dùng khi dev
├─ messages/
│  ├─ vi.json
│  └─ en.json
├─ src/
│  ├─ <file chặn route>.ts       # tên theo tài liệu Next.js 16 (ADR-11); chỉ kiểm tra cookie
│  ├─ app/
│  │  ├─ (auth)/login/  (auth)/register/
│  │  ├─ (app)/                  # layout có thanh bên; kiểm tra phiên đầy đủ (ADR-11)
│  │  │  ├─ today/  inbox/  calendar/  search/  trash/  settings/
│  │  │  ├─ projects/  projects/[projectId]/  projects/[projectId]/backlog/
│  │  │  └─ courses/   courses/[courseId]/
│  │  └─ api/
│  │     ├─ auth/[...all]/route.ts
│  │     └─ v1/...               # file 05
│  ├─ components/
│  │  ├─ ui/                     # shadcn
│  │  ├─ layout/                 # Sidebar, BottomNav, Header
│  │  ├─ board/                  # KanbanBoard, BoardColumn, ListView, CalendarView
│  │  ├─ scrum/                  # BacklogList, SprintPlanner, BurndownChart, VelocityChart
│  │  ├─ schedule/               # DayGrid, WeekGrid, MonthGrid, TimeBlockItem
│  │  ├─ course/                 # CourseCard, SessionEditor, GradeTable
│  │  └─ task/                   # TaskCard, TaskDialog, QuickAdd, SubtaskList
│  ├─ features/
│  │  ├─ tasks/  projects/  boards/  courses/  schedule/  sprints/  progress/  recurrence/
│  │  │  ├─ domain/              # hàm thuần + test cùng chỗ (*.test.ts)
│  │  │  ├─ schemas.ts           # Zod
│  │  │  └─ hooks.ts             # TanStack Query hooks
│  ├─ server/
│  │  ├─ auth.ts                 # cấu hình Better Auth
│  │  ├─ db.ts                   # Prisma client
│  │  ├─ http.ts                 # tiện ích handler: lấy phiên, xử lý lỗi
│  │  ├─ errors.ts               # AppError + mã lỗi
│  │  └─ services/               # một file mỗi miền
│  ├─ lib/
│  │  ├─ dates.ts                # tiện ích múi giờ
│  │  ├─ ordering.ts             # bọc fractional-indexing
│  │  └─ env.ts                  # kiểm tra biến môi trường bằng Zod
│  └─ i18n/
└─ tests/
   └─ e2e/                       # Playwright
```

## 5. Biến môi trường

`.env.example` (không chứa giá trị thật):

```
DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Giai đoạn P4
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
```

`src/lib/env.ts` kiểm tra các biến này bằng Zod khi khởi động; thiếu biến bắt buộc thì dừng với thông báo rõ ràng.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Có | |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Không | Đăng nhập Google chỉ bật khi có **đủ cả hai**. Thiếu một hoặc cả hai: không đăng ký provider Google, trang `/login` và `/register` ẩn nút "Tiếp tục với Google" (US-02). Có một mà thiếu một thì ghi cảnh báo khi khởi động. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` | Từ P4 | Trước P4 để `optional` |

Giới hạn tần suất (NFR-11): từ P0 dùng tính năng rate limit có sẵn của Better Auth cho các route `/api/auth/*`, bộ đếm lưu trong DB (`storage: "database"`), để chạy đúng trên Vercel serverless. Giới hạn cho API ghi `/api/v1/*` làm ở P5.

## 6. Lệnh

```bash
docker compose up -d db     # bật PostgreSQL
npm install
npx prisma migrate dev      # tạo/áp dụng migration
npx prisma db seed          # nạp dữ liệu mẫu
npm run dev
npm run lint
npm run typecheck           # tsc --noEmit
npm run test                # Vitest
npm run test:e2e            # Playwright
npm run build
```

## 7. CI

GitHub Actions trên mỗi pull request:

1. `npm ci`
2. `npm run lint` và `npm run typecheck`
3. `npm run test` (Vitest, có PostgreSQL dịch vụ cho test tích hợp)
4. `npm run build`
5. `npm run test:e2e` (chỉ trên nhánh `main` và PR có nhãn `e2e`, vì chậm)
