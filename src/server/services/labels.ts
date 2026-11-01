import type { CreateLabelInput, LabelDTO, UpdateLabelInput } from "@/features/labels/schemas";
import { Prisma } from "@/generated/prisma/client";
import { toPage, type Page } from "@/lib/pagination";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { invalidInput } from "./task-dto";

// Label service (docs/05 section 2.8, BR-81).

const select = { id: true, name: true, color: true } as const;

/** BR-81: unique per user regardless of case, enforced by index label_user_name_ci. */
function isDuplicateName(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function labelExists(name: string): AppError {
  return new AppError("LABEL_EXISTS", "A label with this name already exists", { name });
}

export async function listLabels(
  userId: string,
  query: { cursor?: string; limit: number },
): Promise<Page<LabelDTO>> {
  if (query.cursor) {
    const exists = await prisma.label.count({ where: { id: query.cursor, userId } });
    if (exists === 0) throw invalidInput("cursor", "Unknown cursor");
  }
  const rows = await prisma.label.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  return toPage(rows, query.limit);
}

export async function createLabel(userId: string, input: CreateLabelInput): Promise<LabelDTO> {
  try {
    return await prisma.label.create({ data: { userId, ...input }, select });
  } catch (error) {
    if (isDuplicateName(error)) throw labelExists(input.name);
    throw error;
  }
}

export async function updateLabel(
  userId: string,
  labelId: string,
  input: UpdateLabelInput,
): Promise<LabelDTO> {
  const label = await prisma.label.findFirst({
    where: { id: labelId, userId },
    select: { id: true },
  });
  if (!label) throw new AppError("NOT_FOUND", "Label not found");
  try {
    return await prisma.label.update({ where: { id: label.id }, data: input, select });
  } catch (error) {
    if (isDuplicateName(error)) throw labelExists(input.name ?? "");
    throw error;
  }
}

/** Removes the label from every task (TaskLabel rows cascade). */
export async function deleteLabel(userId: string, labelId: string): Promise<void> {
  const { count } = await prisma.label.deleteMany({ where: { id: labelId, userId } });
  if (count === 0) throw new AppError("NOT_FOUND", "Label not found");
}
