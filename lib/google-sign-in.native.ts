import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { GOOGLE_WEB_CLIENT_ID } from "@/shared/google-auth";

export type GoogleNativeLoginResult =
  | { kind: "success"; idToken: string; name: string | null; email: string | null; avatarUrl: string | null }
  | { kind: "cancelled" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

let configured = false;

function googleSignInErrorMessage(error: unknown): string {
  const rawCode = isErrorWithCode(error) ? String(error.code) : "";
  const rawMessage = error instanceof Error ? error.message : "";
  const normalized = `${rawCode} ${rawMessage}`.toUpperCase();

  if (normalized.includes("DEVELOPER_ERROR") || rawCode === "10") {
    return "Google Cloud 인증 설정이 앱과 일치하지 않습니다. Android OAuth 클라이언트의 패키지명(com.app.ourstylesolitaire)과 Release SHA-1(78:BE:11:11:3F:19:05:DD:D5:FE:CC:1C:F6:B8:EC:99:B3:50:B4:90)을 확인해 주세요.";
  }
  if (normalized.includes("RNGOOGLESIGNIN") || normalized.includes("NATIVE MODULE")) {
    return "Google 로그인 모듈을 찾지 못했습니다. 이 기능이 포함된 새 APK를 설치한 뒤 다시 시도해 주세요.";
  }
  if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Google Play 서비스를 사용할 수 없거나 업데이트가 필요합니다.";
  }
  if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
    return "Google 로그인이 이미 진행 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  return rawMessage || "Google 로그인 중 알 수 없는 오류가 발생했습니다.";
}

function configureGoogleSignin() {
  if (configured) return;
  GoogleSignin.configure({
    // This is a public Web OAuth client ID. It is the audience of the ID token
    // validated by the game server; no OAuth client secret is used in the app.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<GoogleNativeLoginResult> {
  try {
    configureGoogleSignin();
    const hasPlayServices = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    if (!hasPlayServices) {
      return { kind: "unavailable", message: "Google Play 서비스를 사용할 수 없거나 업데이트가 필요합니다." };
    }
    // Force the account chooser instead of silently reusing the last Google
    // account selected on this device. This signs out only from this app;
    // it does not remove any Google account from Android or the device.
    await GoogleSignin.signOut().catch(() => undefined);
    const response = await GoogleSignin.signIn();

    if (response.type === "cancelled") return { kind: "cancelled" };
    const idToken = response.data.idToken;
    if (!idToken) {
      return {
        kind: "error",
        message: "Google ID 토큰을 받지 못했습니다. Google Cloud의 웹 OAuth Client ID 설정을 확인해 주세요.",
      };
    }

    return {
      kind: "success",
      idToken,
      name: response.data.user.name,
      email: response.data.user.email,
      avatarUrl: response.data.user.photo ?? null,
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { kind: "cancelled" };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { kind: "unavailable", message: googleSignInErrorMessage(error) };
      if (error.code === statusCodes.IN_PROGRESS) return { kind: "error", message: googleSignInErrorMessage(error) };
    }
    return {
      kind: "error",
      message: googleSignInErrorMessage(error),
    };
  }
}

export async function signOutFromGoogle(): Promise<void> {
  configureGoogleSignin();
  await GoogleSignin.signOut();
}
