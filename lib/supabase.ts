const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function requireSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

async function supabaseRequest(endpoint: string, options: RequestInit = {}) {
  requireSupabaseConfig();

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey!,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || "Authentication request failed.");
  }

  return data;
}

export async function supabaseAuth(
  action: "login" | "signup",
  email: string,
  password: string,
  fullName?: string
) {
  const endpoint =
    action === "login"
      ? supabaseUrl + "/auth/v1/token?grant_type=password"
      : supabaseUrl + "/auth/v1/signup";

  const body =
    action === "signup"
      ? {
          email,
          password,
          data: { full_name: fullName || "" },
        }
      : { email, password };

  return supabaseRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  return supabaseRequest(supabaseUrl + "/auth/v1/recover", {
    method: "POST",
    body: JSON.stringify({
      email,
      redirect_to: redirectTo,
    }),
  });
}

export async function verifyRecoveryToken(tokenHash: string) {  return supabaseRequest(supabaseUrl + "/auth/v1/verify", {    method: "POST",    body: JSON.stringify({ token_hash: tokenHash, type: "recovery" }),  });}export async function updatePassword(accessToken: string, password: string) {
  return supabaseRequest(supabaseUrl + "/auth/v1/user", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ password }),
  });
}

export function saveSession(data: { access_token?: string; refresh_token?: string; user?: unknown }) {
  if (typeof window === "undefined") return;
  if (data.access_token) localStorage.setItem("roofray_access_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("roofray_refresh_token", data.refresh_token);
  if (data.user) localStorage.setItem("roofray_user", JSON.stringify(data.user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("roofray_access_token");
  localStorage.removeItem("roofray_refresh_token");
  localStorage.removeItem("roofray_user");
}