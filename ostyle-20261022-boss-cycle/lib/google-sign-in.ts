export type GoogleNativeLoginResult =
  | { kind: "success"; idToken: string; name: string | null; email: string | null; avatarUrl: string | null }
  | { kind: "cancelled" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

/**
 * Google Sign-In requires native Android/iOS code and therefore cannot run in
 * the Expo web preview. The production Android build resolves the .native file.
 */
export async function signInWithGoogle(): Promise<GoogleNativeLoginResult> {
  return {
    kind: "unavailable",
    message: "Google 로그인은 Android 또는 iOS로 빌드된 앱에서 사용할 수 있습니다.",
  };
}

export async function signOutFromGoogle(): Promise<void> {
  // There is no native Google session in the web preview.
}
