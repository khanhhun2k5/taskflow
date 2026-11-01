import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, isApiError, isRetryable, toQuery } from "./api-client";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("apiFetch", () => {
  it("prefixes /api/v1, sends JSON and parses the response", async () => {
    fetchMock.mockResolvedValueOnce(json(201, { id: "t1" }));
    await expect(apiFetch("/tasks", { method: "POST", body: { title: "A" } })).resolves.toEqual({
      id: "t1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"title":"A"}');
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("defaults to GET without a body", async () => {
    fetchMock.mockResolvedValueOnce(json(200, []));
    await apiFetch("/labels");
    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });

  it("resolves 204 to undefined", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch("/tasks/t1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("reads the docs/05 error format into ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { error: { code: "LABEL_EXISTS", message: "dup", details: { name: "x" } } }),
    );
    const error = await apiFetch("/labels", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ code: "LABEL_EXISTS", message: "dup", status: 409 });
    expect((error as ApiError).details).toEqual({ name: "x" });
  });

  it("uses the code as message when the server sends none", async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: { code: "NOT_FOUND" } }));
    await expect(apiFetch("/tasks/x")).rejects.toMatchObject({ message: "NOT_FOUND" });
  });

  it("maps a body that is not the error format to INTERNAL_ERROR", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    await expect(apiFetch("/tasks")).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 502 });
  });

  it("maps a failed request to NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(apiFetch("/tasks")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("rethrows aborts unchanged", async () => {
    const abort = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValueOnce(abort);
    await expect(apiFetch("/tasks")).rejects.toBe(abort);
  });
});

describe("isRetryable (NFR-51)", () => {
  it("retries transient failures only", () => {
    expect(isRetryable(new ApiError("NETWORK_ERROR", "", 0))).toBe(true);
    expect(isRetryable(new ApiError("CONFLICT", "", 409))).toBe(true);
    expect(isRetryable(new ApiError("RATE_LIMITED", "", 429))).toBe(true);
    expect(isRetryable(new ApiError("SOMETHING", "", 503))).toBe(true);
    expect(isRetryable(new Error("boom"))).toBe(true);
    expect(isRetryable(new ApiError("PARENT_DELETED", "", 422))).toBe(false);
    expect(isRetryable(new ApiError("VALIDATION_ERROR", "", 400))).toBe(false);
  });
});

describe("toQuery", () => {
  it("skips undefined values", () => {
    expect(toQuery({ inbox: true, limit: 200, q: undefined })).toBe("?inbox=true&limit=200");
    expect(toQuery({ q: undefined })).toBe("");
  });
});
