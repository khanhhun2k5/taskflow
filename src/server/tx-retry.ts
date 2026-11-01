import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/server/errors";

// Prisma P2034: "Transaction failed due to a write conflict or a deadlock. Please retry".
// The whole transaction is re-run, so callers must keep every side effect inside it.

export const TX_MAX_ATTEMPTS = 3;

type RetryOptions = {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/** Runs `run` up to `attempts` times in total; still conflicting → 409 CONFLICT (docs/05 1.1). */
export async function withTxRetry<T>(
  run: () => Promise<T>,
  { attempts = TX_MAX_ATTEMPTS, sleep = defaultSleep }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      if (attempt >= attempts) {
        throw new AppError("CONFLICT", "The data changed at the same time; please retry", {
          attempts,
        });
      }
      // Short backoff with jitter so two conflicting requests do not collide again.
      await sleep(20 * attempt + Math.floor(Math.random() * 20));
    }
  }
}
