// api/withdrawals.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireSession(req, res) {
  const token = String(req.headers["x-session-token"] || "").trim();
  if (!token) {
    res.status(401).json({ ok: false, error: "missing_session" });
    return null;
  }
  const nowIso = new Date().toISOString();

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("session_token", token)
    .gte("session_expires_at", nowIso)
    .single();

  if (error || !user) {
    res.status(401).json({ ok: false, error: "invalid_session" });
    return null;
  }
  return user;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const user = await requireSession(req, res);
    if (!user) return;

    const { data, error } = await supabase
      .from("withdrawals")
      .select("id, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ ok: false, error: "withdrawals_fetch_failed" });

    return res.status(200).json({ ok: true, withdrawals: data || [] });
  } catch (e) {
    console.error("api/withdrawals crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
