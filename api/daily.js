// api/daily.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_REWARD = 1000;

async function requireSession(req, res) {
  const token = String(req.headers["x-session-token"] || "").trim();
  if (!token) {
    res.status(401).json({ ok: false, error: "missing_session" });
    return null;
  }
  const nowIso = new Date().toISOString();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, balance, last_daily_claim")
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
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const user = await requireSession(req, res);
    if (!user) return;

    const now = new Date();

    if (user.last_daily_claim) {
      const last = new Date(user.last_daily_claim);
      const diffHours = (now - last) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return res.status(400).json({
          ok: false,
          error: "Already claimed today",
          hours_remaining: Number(24 - diffHours).toFixed(2)
        });
      }
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        balance: Number(user.balance || 0) + DAILY_REWARD,
        last_daily_claim: now.toISOString()
      })
      .eq("id", user.id);

    if (updateError) return res.status(500).json({ ok: false, error: updateError.message });

    return res.status(200).json({ ok: true, reward: DAILY_REWARD });
  } catch (e) {
    console.error("Daily bonus error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
