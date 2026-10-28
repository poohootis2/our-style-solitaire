export function parseApiResponseBody<T>(body: string, contentType: string | null, url: string): T {
  const trimmed = body.trim();

  if (contentType?.toLowerCase().includes("application/json")) {
    return JSON.parse(trimmed || "{}") as T;
  }

  if (trimmed.startsWith("<")) {
    throw new Error(
      `API 서버가 JSON 대신 HTML을 반환했습니다. 백엔드 주소가 중단되었거나 잘못되었습니다: ${url}`,
    );
  }

  try {
    return JSON.parse(trimmed || "{}") as T;
  } catch {
    throw new Error(`API 서버가 올바른 JSON을 반환하지 않았습니다: ${url}`);
  }
}
