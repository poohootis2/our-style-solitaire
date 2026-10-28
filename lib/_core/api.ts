import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";
import { parseApiResponseBody } from "./api-response";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

const GOOGLE_LOGIN_RETRY_DELAYS_MS = [0, 700, 1500] as const;

function isTransientGoogleLoginError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    "network request failed",
    "networkerror",
    "fetch failed",
    "timed out",
    "timeout",
    "html 대신",
    "html을 반환했습니다",
    "502",
    "503",
    "504",
    "522",
    "524",
    "service unavailable",
    "bad gateway",
  ].some((marker) => message.includes(marker));
}

async function exchangeGoogleIdTokenWithRetry(
  idToken: string,
): Promise<{ app_session_id: string; user: any }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < GOOGLE_LOGIN_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = GOOGLE_LOGIN_RETRY_DELAYS_MS[attempt];
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      return await apiCall<{ app_session_id: string; user: any }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
    } catch (error) {
      lastError = error;
      if (!isTransientGoogleLoginError(error) || attempt === GOOGLE_LOGIN_RETRY_DELAYS_MS.length - 1) {
        throw error;
      }
      console.warn(`[API] Google login transient failure; retrying (${attempt + 1}/${GOOGLE_LOGIN_RETRY_DELAYS_MS.length - 1})`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Google login request failed.");
}

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine the auth method:
  // - Native platform: use stored session token as Bearer auth
  // - Web (including iframe): use cookie-based auth (browser handles automatically)
  //   Cookie is set on backend domain via POST /api/auth/session after receiving token via postMessage
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    console.log("[API] apiCall:", {
      endpoint,
      hasToken: !!sessionToken,
      method: options.method || "GET",
    });
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
      console.log("[API] Authorization header added");
    }
  } else {
    console.log("[API] apiCall:", { endpoint, platform: "web", method: options.method || "GET" });
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  console.log("[API] Full URL:", url);

  try {
    console.log("[API] Making request...");
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    console.log("[API] Response status:", response.status, response.statusText);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log("[API] Response headers:", responseHeaders);

    // Check if Set-Cookie header is present (cookies are automatically handled in React Native)
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      console.log("[API] Set-Cookie header received:", setCookie);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Error response:", errorText);
      let errorMessage = errorText;
      try {
        const errorJson = parseApiResponseBody<Record<string, string>>(
          errorText,
          response.headers.get("content-type"),
          url,
        );
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch (parseError) {
        errorMessage = parseError instanceof Error ? parseError.message : errorText;
      }
      throw new Error(errorMessage || `API call failed: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    const text = await response.text();
    const data = parseApiResponseBody<T>(text, contentType, url);
    console.log("[API] JSON response received");
    return data;
  } catch (error) {
    console.error("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// OAuth callback handler - exchange code for session token
// Calls /api/oauth/mobile endpoint which returns JSON with app_session_id and user
export async function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<{ sessionToken: string; user: any }> {
  console.log("[API] exchangeOAuthCode called");
  // Use GET with query params
  const params = new URLSearchParams({ code, state });
  const endpoint = `/api/oauth/mobile?${params.toString()}`;
  console.log("[API] Calling OAuth mobile endpoint:", endpoint);
  const result = await apiCall<{ app_session_id: string; user: any }>(endpoint);

  // Convert app_session_id to sessionToken for compatibility
  const sessionToken = result.app_session_id;
  console.log("[API] OAuth exchange result:", {
    hasSessionToken: !!sessionToken,
    hasUser: !!result.user,
    sessionToken: sessionToken ? `${sessionToken.substring(0, 50)}...` : null,
  });

  return {
    sessionToken,
    user: result.user,
  };
}

/** Exchange a Google ID token for the game's own signed mobile session. */
export async function exchangeGoogleIdToken(
  idToken: string,
): Promise<{ sessionToken: string; user: any }> {
  const result = await exchangeGoogleIdTokenWithRetry(idToken);

  if (!result.app_session_id || !result.user) {
    throw new Error("Google login did not return a game session.");
  }

  return {
    sessionToken: result.app_session_id,
    user: result.user,
  };
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    console.error("[API] getMe failed:", error);
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  try {
    console.log("[API] establishSession: setting cookie on backend...");
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      console.error("[API] establishSession failed:", response.status);
      return false;
    }

    console.log("[API] establishSession: cookie set successfully");
    return true;
  } catch (error) {
    console.error("[API] establishSession error:", error);
    return false;
  }
}
