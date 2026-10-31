# 05. Đặc tả API

## 1. Quy ước chung

- Tiền tố: `/api/v1`. Định dạng JSON, mã hóa UTF-8.
- Xác thực: cookie phiên của Better Auth. Không có phiên → `401 UNAUTHENTICATED`.
- Mọi đầu vào kiểm tra bằng schema Zod trong `src/features/*/schemas.ts`. Kiểu TypeScript suy ra bằng `z.infer`.
- Thời điểm gửi và nhận dạng ISO 8601 UTC (`"2026-11-03T02:00:00.000Z"`). Ngày thuần (không giờ) dạng `"2026-11-03"`.
- Truy cập tài nguyên của người khác trả `404 NOT_FOUND` (không trả 403, để không lộ việc tài nguyên tồn tại).
- Danh sách dùng phân trang con trỏ: `?cursor=<id>&limit=50` (mặc định 50, tối đa 200). Phản hồi: `{ items: [...], nextCursor: string | null }`.
- `PATCH` chỉ gửi các trường cần đổi.

### 1.1 Định dạng lỗi

```json
{
  "error": {
    "code": "WIP_LIMIT_EXCEEDED",
    "message": "Cột \"Đang làm\" đã đạt giới hạn 3 việc.",
    "details": { "columnId": "c_123", "limit": 3, "current": 3 }
  }
}
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Đầu vào sai schema; `details` là danh sách lỗi theo trường |
| 401 | `UNAUTHENTICATED` | Chưa đăng nhập |
| 404 | `NOT_FOUND` | Không tồn tại hoặc không thuộc người dùng |
| 409 | `WIP_LIMIT_EXCEEDED` | BR-30 |
| 409 | `SPRINT_ALREADY_ACTIVE` | BR-40 |
| 409 | `SPRINT_NOT_ACTIVE` | Kết thúc sprint không ở trạng thái `ACTIVE` |
| 422 | `ESTIMATE_REQUIRED` | BR-41 |
| 422 | `BOARD_NEEDS_TODO_AND_DONE` | BR-25 |
| 422 | `SUBTASK_DEPTH_EXCEEDED` | BR-05 |
| 422 | `INVALID_RECURRENCE_RULE` | BR-71 |
| 422 | `PROJECT_ARCHIVED` | Ghi vào dự án đã lưu trữ (BR-22) |
| 429 | `RATE_LIMITED` | NFR-11: route xác thực từ P0 (Better Auth); API ghi từ P5 |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước; không lộ chi tiết |

### 1.2 Đối tượng `TaskDTO`

```ts
type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  statusCategory: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  startAt: string | null;
  dueAt: string | null;
  dueAllDay: boolean;
  estimate: number | null;
  isMilestone: boolean;
  completedAt: string | null;
  projectId: string | null;
  courseId: string | null;
  columnId: string | null;
  sprintId: string | null;
  parentId: string | null;
  order: string;
  labels: { id: string; name: string; color: string }[];
  subtaskCount: { total: number; done: number };
  isOverdue: boolean;          // tính ở server theo BR-04
  updatedAt: string;
};
```

## 2. Endpoint

Cột "GĐ" là giai đoạn ra mắt (file 10).

### 2.1 Xác thực

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| * | `/api/auth/*` | Do Better Auth xử lý (đăng ký, đăng nhập, Google, đăng xuất) | P0 |
| GET | `/api/v1/me` | Thông tin người dùng + cài đặt | P0 |
| PATCH | `/api/v1/me` | Đổi tên, múi giờ, ngôn ngữ, ngày đầu tuần | P0 |

### 2.2 Việc

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/tasks` | Lọc: `projectId`, `courseId`, `inbox=true`, `status`, `priority`, `labelId`, `dueFrom`, `dueTo`, `overdue=true`, `q`, `sprintId`, `backlog=true`, `parentId`, `sort` | MVP-1 |
| POST | `/tasks` | Tạo việc. Chỉ `title` bắt buộc | MVP-1 |
| GET | `/tasks/:id` | Chi tiết + việc con + nhãn + 20 hoạt động gần nhất | MVP-1 |
| PATCH | `/tasks/:id` | Sửa thuộc tính | MVP-1 |
| DELETE | `/tasks/:id` | Xóa mềm (BR-09, BR-10) | MVP-1 |
| POST | `/tasks/:id/restore` | Khôi phục | MVP-1 |
| POST | `/tasks/:id/move` | Đổi cột và/hoặc vị trí | MVP-1 |
| POST | `/tasks/bulk` | Sửa hàng loạt (BR-31) | MVP-1 |
| GET | `/trash` | Việc, dự án, môn học đã xóa trong 30 ngày | MVP-1 |

**POST `/tasks`**

```ts
const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).optional(),
  projectId: z.string().optional(),
  courseId: z.string().optional(),
  columnId: z.string().optional(),         // không có → cột TODO đầu tiên (BR-27)
  parentId: z.string().optional(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  dueAt: z.iso.datetime().optional(),
  dueAllDay: z.boolean().default(true),
  startAt: z.iso.datetime().optional(),
  estimate: z.number().min(0).max(9999).optional(),
  labelIds: z.array(z.string()).max(20).optional(),
  isMilestone: z.boolean().default(false),
});
```

Phản hồi `201` với `TaskDTO`.

**POST `/tasks/:id/move`**

```ts
const moveTaskSchema = z.object({
  columnId: z.string(),
  beforeId: z.string().nullable(),   // việc ngay trên vị trí thả (null = đầu cột)
  afterId: z.string().nullable(),    // việc ngay dưới vị trí thả (null = cuối cột)
});
```

Server tính khóa `order` mới nằm giữa `beforeId` và `afterId` (ADR-05), gán `statusCategory` theo cột (BR-01), kiểm tra WIP (BR-30), ghi `ActivityLog` nếu trạng thái đổi. Phản hồi `200` với `TaskDTO` và `warnings: ["WIP_LIMIT_EXCEEDED"]` khi vượt giới hạn ở chế độ cảnh báo.

**POST `/tasks/bulk`**

```ts
const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("move"), columnId: z.string() }),
    z.object({ type: z.literal("setStatus"), status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) }), // chỉ việc lẻ
    z.object({ type: z.literal("setPriority"), priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]) }),
    z.object({ type: z.literal("addLabel"), labelId: z.string() }),
    z.object({ type: z.literal("removeLabel"), labelId: z.string() }),
    z.object({ type: z.literal("setDue"), dueAt: z.iso.datetime().nullable() }),
    z.object({ type: z.literal("delete") }),
  ]),
});
```

Thực hiện trong một giao dịch: lỗi ở một việc thì không đổi việc nào.

### 2.3 Dự án, bảng, cột

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/projects` | Danh sách + tiến độ tóm tắt (`progress`, `overdueCount`) | MVP-1 |
| POST | `/projects` | Tạo dự án + bảng + 3 cột (BR-20) | MVP-1 |
| GET | `/projects/:id` | Chi tiết | MVP-1 |
| PATCH | `/projects/:id` | Sửa, đổi quy trình, lưu trữ | MVP-1 |
| DELETE | `/projects/:id` | Xóa mềm (BR-11) | MVP-1 |
| POST | `/projects/:id/restore` | Khôi phục | MVP-1 |
| GET | `/boards/:id` | Cột + việc cha (không có việc con) của bảng; có `?sprintId=` | MVP-1 |
| POST | `/boards/:id/columns` | Thêm cột | MVP-1 |
| PATCH | `/columns/:id` | Đổi tên, nhóm trạng thái, WIP. Đổi nhóm trạng thái cập nhật mọi việc trong cột (ADR-03) | MVP-1 |
| POST | `/columns/:id/move` | Đổi thứ tự cột (`beforeId`, `afterId`) | MVP-1 |
| DELETE | `/columns/:id?moveTo=<columnId>` | Xóa cột, chuyển việc (BR-26) | MVP-1 |

**GET `/boards/:id`** phản hồi:

```ts
type BoardDTO = {
  id: string;
  projectId: string | null;
  courseId: string | null;
  columns: {
    id: string; name: string; statusCategory: StatusCategory; order: string;
    wipLimit: number | null; wipStrict: boolean;
    tasks: TaskDTO[];          // đã sắp theo order
  }[];
};
```

### 2.4 Tiến độ

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/projects/:id/progress` | `{ count: P, weighted: P_w, done, total, overdue: TaskDTO[] }` (file 07) | MVP-1 |
| GET | `/sprints/:id/burndown` | `{ days: [{ date, ideal, remaining, scope }] }` | MVP-3 |
| GET | `/projects/:id/velocity` | `{ sprints: [{ id, name, committed, completed }], average }` | MVP-3 |

### 2.5 Scrum

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/projects/:id/sprints` | Danh sách sprint | MVP-3 |
| POST | `/projects/:id/sprints` | Tạo sprint `PLANNED` | MVP-3 |
| PATCH | `/sprints/:id` | Sửa tên, mục tiêu, ngày (chỉ khi chưa `COMPLETED`) | MVP-3 |
| DELETE | `/sprints/:id` | Xóa sprint `PLANNED`; việc về backlog | MVP-3 |
| POST | `/sprints/:id/tasks` | `{ taskIds: string[] }` thêm việc vào sprint (BR-41, BR-42) | MVP-3 |
| DELETE | `/sprints/:id/tasks/:taskId` | Đưa việc về backlog | MVP-3 |
| POST | `/sprints/:id/start` | Bắt đầu (BR-40, BR-43) | MVP-3 |
| POST | `/sprints/:id/complete` | Kết thúc (BR-45, BR-46) | MVP-3 |
| POST | `/projects/:id/backlog/move` | Sắp xếp backlog (`taskId`, `beforeId`, `afterId`) | MVP-3 |

**POST `/sprints/:id/complete`**

```ts
const completeSprintSchema = z.discriminatedUnion("unfinished", [
  z.object({ unfinished: z.literal("BACKLOG") }),
  z.object({ unfinished: z.literal("NEXT_SPRINT"), nextSprintId: z.string() }),
]);
```

Phản hồi: `{ sprint: SprintDTO, movedTaskIds: string[], velocity: number }`.

### 2.6 Môn học

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/courses` | Danh sách + số việc sắp đến hạn + điểm hiện tại | MVP-2 |
| POST | `/courses` | Tạo môn + bảng (BR-23) | MVP-2 |
| GET/PATCH/DELETE | `/courses/:id` | Chi tiết / sửa / xóa mềm (BR-11) | MVP-2 |
| POST | `/courses/:id/sessions` | Thêm buổi học | MVP-2 |
| PATCH/DELETE | `/sessions/:id` | Sửa / xóa buổi học | MVP-2 |
| PUT | `/sessions/:id/exceptions/:date` | Hủy hoặc đổi một buổi (BR-52) | MVP-2 |
| DELETE | `/sessions/:id/exceptions/:date` | Bỏ ngoại lệ | MVP-2 |
| GET | `/courses/:id/grades` | Thành phần + kết quả tính (file 07) | MVP-2 |
| PUT | `/courses/:id/grades` | Ghi đè toàn bộ danh sách thành phần | MVP-2 |

### 2.7 Lịch trình

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET | `/today` | Dữ liệu trang Hôm nay (mục 6.1 file 02) | MVP-2 |
| GET | `/agenda?from=&to=` | Gộp buổi học, khung giờ, việc có hạn trong khoảng; tối đa 62 ngày | MVP-2 |
| POST | `/time-blocks` | Tạo khung giờ | MVP-2 |
| PATCH/DELETE | `/time-blocks/:id` | Sửa / xóa | MVP-2 |

**GET `/agenda`** phản hồi:

```ts
type AgendaItem =
  | { kind: "class"; courseId: string; title: string; color: string; startAt: string; endAt: string; room: string | null; cancelled: boolean }
  | { kind: "block"; id: string; taskId: string | null; title: string; startAt: string; endAt: string; color: string }
  | { kind: "task"; task: TaskDTO };
type AgendaResponse = { items: AgendaItem[] };
```

### 2.8 Nhãn và tìm kiếm

| Phương thức | Đường dẫn | Mô tả | GĐ |
|---|---|---|---|
| GET/POST | `/labels` | Danh sách / tạo | MVP-1 |
| PATCH/DELETE | `/labels/:id` | Sửa / xóa (gỡ khỏi mọi việc) | MVP-1 |
| GET | `/search?q=` | Tìm việc, dự án, môn học (BR-82); tối đa 30 kết quả | MVP-2 |

### 2.9 Mở rộng (P4)

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET/POST | `/recurring` | Danh sách / tạo chuỗi lặp |
| PATCH/DELETE | `/recurring/:id` | Sửa / dừng chuỗi |
| PUT | `/tasks/:id/reminders` | Ghi đè danh sách lời nhắc (tối đa 3) |
| GET | `/notifications` | Danh sách thông báo |
| POST | `/notifications/read` | Đánh dấu đã đọc |
| POST | `/push/subscribe` | Lưu đăng ký Web Push |
| GET | `/export/tasks.csv` | Xuất CSV theo bộ lọc như `GET /tasks` |
| GET | `/export/calendar.ics?token=` | Lịch đăng ký, xác thực bằng token bí mật thay vì cookie |
| POST | `/me/calendar-token` | Tạo lại token lịch (vô hiệu token cũ) |
| GET | `/cron/reminders` | Vercel Cron gọi mỗi 5 phút; yêu cầu header `Authorization: Bearer $CRON_SECRET` |

## 3. Mẫu Route Handler

```ts
// src/app/api/v1/tasks/[id]/move/route.ts
import { withUser } from "@/server/http";
import { moveTaskSchema } from "@/features/tasks/schemas";
import { moveTask } from "@/server/services/tasks";

export const POST = withUser(async (req, { userId, params }) => {
  const input = moveTaskSchema.parse(await req.json());   // ZodError → 400
  return moveTask(userId, params.id, input);              // AppError → mã HTTP tương ứng
});
```

`withUser` lấy phiên, trả 401 nếu không có, bắt `ZodError`/`AppError` và đổi sang định dạng lỗi ở mục 1.1.
