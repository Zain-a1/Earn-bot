// api/withdraw.js (ESM)
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
    .select("id, balance")
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

    const amount = Number((req.body || {}).amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }

    if (Number(user.balance || 0) < amount) {
      return res.status(400).json({ ok: false, error: "insufficient_balance", balance: user.balance || 0 });
    }

    const { data: w, error: wErr } = await supabase
      .from("withdrawals")
      .insert([{ user_id: user.id, amount, status: "pending" }])
      .select("id, user_id, amount, status, created_at")
      .single();

    if (wErr) {
      console.error("withdraw insert error:", wErr);
      return res.status(500).json({ ok: false, error: "withdraw_create_failed" });
    }

    return res.status(200).json({ ok: true, withdrawal: w });
  } catch (e) {
    console.error("api/withdraw crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
