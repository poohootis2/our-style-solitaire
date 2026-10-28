import { describe, expect, it } from "vitest";

import { parseApiResponseBody } from "../lib/_core/api-response";

describe("parseApiResponseBody", () => {
  it("parses JSON responses", () => {
    expect(
      parseApiResponseBody<{ ok: boolean }>(
        '{"ok":true}',
        "application/json; charset=utf-8",
        "https://api.example.test/api/health",
      ),
    ).toEqual({ ok: true });
  });

  it("reports an unavailable backend when HTML is returned", () => {
    expect(() =>
      parseApiResponseBody(
        "<!doctype html><title>Site Unavailable</title>",
        "text/html",
        "https://api.example.test/api/auth/google",
      ),
    ).toThrow("API 서버가 JSON 대신 HTML을 반환했습니다");
  });
});
