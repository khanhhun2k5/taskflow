// `npx prisma db seed` (prisma.config.ts). MVP-1 part of docs/04 section 5: the demo user,
// 2 projects, labels, and 5 inbox tasks of which 2 are overdue. Courses (MVP-2) and sprints
// (MVP-3) are added with their phases. Safe to re-run: it rebuilds the demo user's data.
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TIMEZONE,
  ensureDemoUser,
  loadServer,
  prepare,
  resetDemoData,
} from "./seed-lib";

prepare();

async function main() {
  const { addDaysInTz, utcToZonedParts, zonedToUtcIso } = await import("@/lib/dates");
  const { createTaskSchema } = await import("@/features/tasks/schemas");
  const server = await loadServer();
  const now = new Date();

  /** All-day due date `days` from today in the demo user's zone (NFR-32). */
  const dueIn = (days: number) =>
    zonedToUtcIso(
      utcToZonedParts(addDaysInTz(now, days, DEMO_TIMEZONE).toISOString(), DEMO_TIMEZONE).date,
      null,
      DEMO_TIMEZONE,
    );

  type TaskSeed = {
    title: string;
    priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
    estimate?: number;
    due?: number;
    labels?: string[];
  };

  const userId = await ensureDemoUser(server);
  await resetDemoData(server, userId);
  const { tasks, projects, labels, boards } = server;

  const labelIds = new Map<string, string>();
  for (const [name, color] of [
    ["Thiết kế", "#8B5CF6"],
    ["Nội dung", "#0891B2"],
    ["Gấp", "#EF4444"],
    ["Học tập", "#16A34A"],
  ] as const) {
    labelIds.set(name, (await labels.createLabel(userId, { name, color })).id);
  }

  async function addTask(placement: { columnId?: string; parentId?: string }, seed: TaskSeed) {
    const input = createTaskSchema.parse({
      title: seed.title,
      priority: seed.priority,
      estimate: seed.estimate,
      dueAt: seed.due === undefined ? undefined : dueIn(seed.due),
      labelIds: seed.labels?.map((name) => labelIds.get(name) ?? ""),
      ...placement,
    });
    return tasks.createTask(userId, input, now);
  }

  // "Website cá nhân": Kanban, 12 tasks over the three default columns, WIP 3 on "Đang làm".
  const website = await projects.createProject(userId, {
    name: "Website cá nhân",
    color: "#6366F1",
    workflow: "KANBAN",
    estimateUnit: "POINTS",
  });
  const board = await boards.getBoard(userId, website.boardId ?? "", {}, now);
  const [todo, doing, done] = board.columns;
  await boards.updateColumn(userId, doing.id, { wipLimit: 3 }, now);

  const plan: [string, TaskSeed[]][] = [
    [
      todo.id,
      [
        { title: "Viết trang Giới thiệu", estimate: 3, due: 5, labels: ["Nội dung"] },
        { title: "Chọn bảng màu và phông chữ", estimate: 2, labels: ["Thiết kế"] },
        { title: "Tối ưu ảnh cho điện thoại", estimate: 2, priority: "LOW" },
        { title: "Thêm trang Dự án đã làm", estimate: 5, due: 10 },
        { title: "Sửa lỗi menu trên Safari", priority: "URGENT", due: -1, labels: ["Gấp"] },
      ],
    ],
    [
      doing.id,
      [
        {
          title: "Thiết kế trang chủ",
          estimate: 5,
          priority: "HIGH",
          due: 2,
          labels: ["Thiết kế"],
        },
        { title: "Viết bài blog đầu tiên", estimate: 3, labels: ["Nội dung"] },
        { title: "Cấu hình tên miền", estimate: 1, due: 0 },
      ],
    ],
    [
      done.id,
      [
        { title: "Mua tên miền", estimate: 1 },
        { title: "Dựng khung Next.js", estimate: 3 },
        { title: "Vẽ wireframe", estimate: 2, labels: ["Thiết kế"] },
        { title: "Lên danh sách trang", estimate: 1 },
      ],
    ],
  ];
  for (const [columnId, seeds] of plan) for (const seed of seeds) await addTask({ columnId }, seed);

  // One task with subtasks (BR-05: one level), one of them done.
  const home = (
    await tasks.listTasks(
      userId,
      { projectId: website.id, sort: "title", limit: 50, q: "Thiết kế trang chủ" },
      now,
    )
  ).items[0];
  for (const title of ["Phần đầu trang", "Danh sách dự án nổi bật", "Chân trang"])
    await addTask({ parentId: home.id }, { title });
  const firstSub = (await tasks.getTask(userId, home.id, now)).subtasks[0];
  await tasks.updateTask(userId, firstSub.id, { statusCategory: "DONE" }, now);

  // "Ứng dụng đặt lịch": Scrum. TODO(MVP-3): 2 finished sprints and 1 active (docs/04 section 5).
  const booking = await projects.createProject(userId, {
    name: "Ứng dụng đặt lịch",
    color: "#0D9488",
    workflow: "SCRUM",
    estimateUnit: "POINTS",
  });
  for (const seed of [
    { title: "Đăng nhập bằng email", estimate: 3 },
    { title: "Chọn khung giờ trống", estimate: 5 },
    { title: "Gửi email xác nhận", estimate: 2 },
    { title: "Trang quản trị lịch hẹn", estimate: 8 },
  ]) {
    await tasks.createTask(userId, createTaskSchema.parse({ ...seed, projectId: booking.id }), now);
  }

  // Inbox: 5 loose tasks, 2 overdue (BR-04).
  for (const seed of [
    { title: "Nộp học phí học kỳ", priority: "HIGH", due: -2, labels: ["Gấp"] },
    { title: "Gọi lại cho chủ nhà", due: -1 },
    { title: "Đọc chương 3 giáo trình", due: 0, labels: ["Học tập"] },
    { title: "Mua sổ tay mới", due: 3, priority: "LOW" },
    { title: "Lên ý tưởng quà sinh nhật" },
  ] satisfies TaskSeed[]) {
    await addTask({}, seed);
  }

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}). Development data only.`);
  await server.prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
