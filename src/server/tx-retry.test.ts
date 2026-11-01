import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError, errorBody } from "@/server/errors";
import { withTxRetry } from "./tx-retry";

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict", {
    code: "P2034",
    clientVersion: "test",
  });

const noSleep = () => Promise.resolve();

describe("withTxRetry (P2034)", () => {
  it("succeeds on the third attempt after two write conflicts", async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce("ok");
    await expect(withTxRetry(run, { sleep: noSleep })).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("maps a conflict that persists after 3 attempts to 409 CONFLICT", async () => {
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(conflict());
    const error = await withTxRetry(run, { sleep: noSleep }).catch((e: unknown) => e);
    expect(run).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.code).toBe("CONFLICT");
    expect(appError.status).toBe(409);
    expect(errorBody(appError.code, appError.message, appError.details)).toEqual({
      error: { code: "CONFLICT", message: expect.any(String), details: { attempts: 3 } },
    });
  });

  it("does not retry other errors", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(other);
    await expect(withTxRetry(run, { sleep: noSleep })).rejects.toBe(other);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("waits between attempts", async () => {
    const sleep = vi.fn(noSleep);
    const run = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(conflict())
      .mockResolvedValue(1);
    await withTxRetry(run, { sleep });
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
