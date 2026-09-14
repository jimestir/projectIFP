import type { UserPublic } from "../types";

const TOKEN_KEY = "sfp_token";
const USER_KEY = "sfp_user";

export function loadSession(): { token: string; user: UserPublic } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, user: JSON.parse(raw) as UserPublic };
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: UserPublic) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
