import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { GOOGLE_WEB_CLIENT_ID, googleOpenId } from "../../shared/google-auth.js";
import { OAuth2Client } from "google-auth-library";
import type { JWTPayload } from "jose";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const googleIdTokenVerifier = new OAuth2Client();

type GoogleIdTokenPayload = JWTPayload & {
  email?: string;
  picture?: string;
  name?: string;
};

async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  let primaryError: unknown;
  try {
    const ticket = await googleIdTokenVerifier.verifyIdToken({
      idToken,
      audience: GOOGLE_WEB_CLIENT_ID,
    });
    return ticket.getPayload() as GoogleIdTokenPayload;
  } catch (error) {
    primaryError = error;
  }

  try {
    // Vercel's serverless runtime can occasionally fail while converting a
    // freshly fetched Google PEM certificate. Retry the same verification
    // against Google's official rotating JWK endpoint without weakening the
    // issuer, audience, signature, or expiry checks.
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const googleJwkSet = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
    const { payload } = await jwtVerify(idToken, googleJwkSet, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: GOOGLE_WEB_CLIENT_ID,
    });
    console.warn(
      "[GoogleAuth] PEM verification failed; JWK verification succeeded:",
      primaryError instanceof Error ? primaryError.message : String(primaryError),
    );
    return payload as GoogleIdTokenPayload;
  } catch (jwkError) {
    // Last-resort verification through Google's tokeninfo endpoint. This is
    // still Google's own signature/claim validation, and we additionally
    // enforce the expected audience, issuer, expiry, and subject locally.
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Google token verification failed (PEM: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}; JWK: ${jwkError instanceof Error ? jwkError.message : String(jwkError)}; tokeninfo: HTTP ${response.status})`,
      );
    }
    const payload = (await response.json()) as GoogleIdTokenPayload & {
      iss?: string;
      aud?: string;
      exp?: string | number;
    };
    const expiresAt = Number(payload.exp);
    if (
      !payload.sub
      || payload.aud !== GOOGLE_WEB_CLIENT_ID
      || (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com")
      || !Number.isFinite(expiresAt)
      || expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error("Google tokeninfo returned an invalid audience, issuer, subject, or expiry.");
    }
    console.warn("[GoogleAuth] PEM/JWK verification failed; tokeninfo verification succeeded.");
    return payload;
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        countryCode?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    avatarUrl: (user as any)?.avatarUrl ?? null,
    loginMethod: user?.loginMethod ?? null,
    countryCode: (user as any)?.countryCode ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  /**
   * Native Google Sign-In supplies an ID token. Verify its Google signature and
   * audience on the server, then issue the same app session used by tRPC.
   * The OAuth client secret is never sent to, stored in, or used by the app.
   */
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
    if (!idToken || idToken.length > 12_000) {
      res.status(400).json({ error: "A Google ID token is required." });
      return;
    }

    try {
      const payload = await verifyGoogleIdToken(idToken);
      if (!payload?.sub) {
        res.status(401).json({ error: "Google ID token has no subject." });
        return;
      }

      const openId = googleOpenId(payload.sub);
      const signedInAt = new Date();
      await upsertUser({
        openId,
        // Omit name so a nickname selected in the game is never overwritten
        // by a Google profile name on a later sign-in.
        email: typeof payload.email === "string" ? payload.email : null,
        avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
        loginMethod: "google",
        lastSignedIn: signedInAt,
      });
      const user = await getUserByOpenId(openId);
      if (!user) {
        res.status(503).json({ error: "Unable to create the game account. Please try again." });
        return;
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: payload.name || "Google Player",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.warn("[GoogleAuth] ID token verification failed", error instanceof Error ? error.message : String(error));
      res.status(401).json({ error: "Google authentication could not be verified." });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend URL (Expo web on port 8081)
      // Cookie is set with parent domain so it works across both 3000 and 8081 subdomains
      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
