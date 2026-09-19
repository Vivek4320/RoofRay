const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function supabaseAuth(
  action: "login" | "signup",
  email: string,
  password: string,
  fullName?: string
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const endpoint =
    action === "login"
      ? `${supabaseUrl}/auth/v1/token?grant_type=password`
      : `${supabaseUrl}/auth/v1/signup`;

  const body =
    action === "signup"
      ? {
          email,
          password,
          data: { full_name: fullName || "" },
        }
      : { email, password };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || "Authentication failed.");
  }

  return data;
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
