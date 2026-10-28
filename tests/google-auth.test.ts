import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

import { GOOGLE_OPEN_ID_PREFIX, GOOGLE_WEB_CLIENT_ID, googleOpenId } from "../shared/google-auth";

const oauthSource = readFileSync(new URL("../server/_core/oauth.ts", import.meta.url), "utf8");
const nativeLoginSource = readFileSync(new URL("../lib/google-sign-in.native.ts", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("../app/(tabs)/index.tsx", import.meta.url), "utf8");

describe("Google account login", () => {
  it("uses the public Web OAuth client ID as the token audience", () => {
    expect(GOOGLE_WEB_CLIENT_ID).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
    expect(oauthSource).toContain("verifyIdToken");
    expect(oauthSource).toContain("audience: GOOGLE_WEB_CLIENT_ID");
    expect(nativeLoginSource).toContain("webClientId: GOOGLE_WEB_CLIENT_ID");
  });

  it("creates a stable non-email game account identity from Google subject", () => {
    expect(googleOpenId("1133557799")).toBe(`${GOOGLE_OPEN_ID_PREFIX}1133557799`);
    expect(oauthSource).toContain("googleOpenId(payload.sub)");
    expect(oauthSource).not.toContain("openId: payload.email");
  });

  it("keeps secrets out of the client and exposes account controls in the profile", () => {
    expect(nativeLoginSource).not.toMatch(/clientSecret|GOCSPX-/);
    expect(oauthSource).not.toMatch(/clientSecret|GOCSPX-/);
    expect(profileSource).toContain("Google 로그인");
    expect(profileSource).toContain("프로필·Google 로그인");
    expect(profileSource).toContain("logoutFromGoogle");
    expect(profileSource).toContain("showGoogleAccountMenu");
    expect(profileSource).toContain("다른 계정으로 전환");
    expect(profileSource).toContain("recordsMenuButton");
    expect(profileSource).toContain("cardBacksMenuButton");
  });

  it("keeps the native login button usable while the profile query is loading and explains Android setup failures", () => {
    expect(profileSource).toContain("disabled={googleAuthPending}");
    expect(profileSource).toContain("Google 로그인 창을 여는 중");
    expect(nativeLoginSource).toContain("DEVELOPER_ERROR");
    expect(nativeLoginSource).toContain("com.app.ourstylesolitaire");
    expect(nativeLoginSource).toContain("78:BE:11:11:3F:19:05:DD:D5:FE:CC:1C:F6:B8:EC:99:B3:50:B4:90");
  });
});
