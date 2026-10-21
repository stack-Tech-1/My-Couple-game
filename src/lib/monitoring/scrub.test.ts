import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent, scrubText } from "./scrub";

describe("error report scrubbing", () => {
  it("removes emails and one-time tokens from text", () => {
    expect(scrubText("/auth/confirm?token_hash=abc123&type=email&next=/room")).toBe("/auth/confirm?token_hash=[filtered]&type=email&next=/room");
    expect(scrubText("/email/unsubscribe?u=1&t=SeCrEt")).toBe("/email/unsubscribe?u=1&t=[filtered]");
    expect(scrubText("could not send to ada@example.com")).toBe("could not send to [email]");
  });

  it("keeps only an id for the user and drops request bodies, cookies, headers and typed input", () => {
    const e = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "ada@example.com", ip_address: "1.2.3.4" },
      request: { url: "https://amah.app/auth/callback?code=xyz", data: { body: "secret note" }, cookies: { sb: "jwt" }, headers: { cookie: "sb=jwt", "user-agent": "UA" }, query_string: "code=xyz" },
      exception: { values: [{ type: "Error", value: "failed for bo@example.com" }] },
      breadcrumbs: [
        { category: "ui.input", message: "typed: i love you" },
        { category: "console", message: "log" },
        { category: "navigation", message: "to /email/unsubscribe?t=abc", data: { url: "/x?token=abc" } },
      ],
    } as unknown as ErrorEvent)!;
    expect(e.user).toEqual({ id: "u1" });
    expect(e.request).toEqual({ url: "https://amah.app/auth/callback?code=[filtered]", headers: { "user-agent": "UA" }, query_string: "[filtered]" });
    expect(e.exception!.values![0]!.value).toBe("failed for [email]");
    expect(e.breadcrumbs).toEqual([{ category: "navigation", message: "to /email/unsubscribe?t=[filtered]", data: { url: "/x?token=[filtered]" } }]);
  });
});

describe("network errors", () => {
  it("treats dropped connections as expected, not as bugs", async () => {
    const { isNetworkError } = await import("./scrub");
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Couldn't reach the server. Is the Wi-Fi napping?"))).toBe(true);
    expect(isNetworkError(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });
});
