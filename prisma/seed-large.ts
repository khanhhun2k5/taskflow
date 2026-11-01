// `npm run db:seed:large`: one Kanban project with 500 tasks for the demo user, to try
// NFR-03 (dragging stays smooth with 500 tasks). Run `npx prisma db seed` first or not: the
// demo account is created if missing. Re-running replaces only this project.
import { ensureDemoUser, loadServer, prepare } from "./seed-lib";

prepare();

async function main() {
  const PROJECT_NAME = "Kiểm thử 500 việc";
  const COUNTS = [250, 150, 100]; // To do, In progress, Done

  const { createTaskSchema } = await import("@/features/tasks/schemas");
  const server = await loadServer();
  const { prisma, projects, boards, tasks } = server;
  const now = new Date();
  const userId = await ensureDemoUser(server);

  const old = await prisma.project.findMany({
    where: { userId, name: PROJECT_NAME },
    select: { id: true },
  });
  if (old.length > 0) {
    const ids = old.map((project) => project.id);
    await prisma.task.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
  }

  const project = await projects.createProject(userId, { name: PROJECT_NAME, color: "#EA580C" });
  const board = await boards.getBoard(userId, project.boardId ?? "", {}, now);
  const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  let n = 0;
  for (const [index, count] of COUNTS.entries()) {
    const columnId = board.columns[index].id;
    for (let i = 0; i < count; i += 1) {
      n += 1;
      await tasks.createTask(
        userId,
        createTaskSchema.parse({
          title: `Việc số ${n}`,
          columnId,
          priority: priorities[n % 4],
          estimate: (n % 5) + 1,
        }),
        now,
      );
    }
  }

  console.log(`Created "${PROJECT_NAME}" with ${n} tasks (board ${board.id}).`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
