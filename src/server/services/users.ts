import type { MeDTO, UpdateMeInput } from "@/features/users/schemas";
import { localeSchema, weekStartsOnSchema } from "@/features/users/schemas";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";

function toMeDTO(user: User): MeDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    timezone: user.timezone,
    locale: localeSchema.catch("vi").parse(user.locale),
    weekStartsOn: weekStartsOnSchema.catch(1).parse(user.weekStartsOn),
    createdAt: user.createdAt.toISOString(),
  };
}

// US-03 / NFR-10: userId always comes from the session, never from the request body.
export async function getMe(userId: string): Promise<MeDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  return toMeDTO(user);
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<MeDTO> {
  const { count } = await prisma.user.updateMany({ where: { id: userId }, data: input });
  if (count === 0) throw new AppError("NOT_FOUND", "User not found");
  return getMe(userId);
}
