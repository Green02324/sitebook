import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "sitebook.refreshToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// expo-secure-store's web shim is incomplete in this SDK version (throws on
// getItemAsync) — the real target is iOS/Android where SecureStore is fully
// native, but we still shouldn't crash the app when running on web (e.g.
// during browser-based smoke testing), so treat any failure as "no session".
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {
    // ignore — session simply won't persist across reloads on this platform
  }
}
