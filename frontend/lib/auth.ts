// Auth state lives in sessionStorage (not localStorage) so closing the
// browser/tab ends the session - reopening the site always requires signing
// in again, rather than staying logged in indefinitely on a shared machine.

function decodeJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveAuth(data: { access_token: string; refresh_token: string; user: any }) {
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("refresh_token", data.refresh_token);
  sessionStorage.setItem("user", JSON.stringify(data.user));
}

export function clearAuth() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user");
}

export function getUser() {
  const token = sessionStorage.getItem("access_token");
  if (!token) return null;

  const expiresAt = decodeJwtExpiry(token);
  if (expiresAt !== null && Date.now() >= expiresAt) {
    clearAuth();
    return null;
  }

  const user = sessionStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!getUser();
}
