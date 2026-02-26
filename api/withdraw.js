// api/withdraw.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const body = req.body || {};
    const telegram_id = String(body.telegram_id || "").trim();
    const amount = Number(body.amount);

    if (!telegram_id) return res.status(400).json({ ok: false, error: "missing_telegram_id" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

    // Load user
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id, balance")
      .eq("telegram_id", telegram_id)
      .single();

    if (uErr || !user) return res.status(404).json({ ok: false, error: "user_not_found" });

    // Optional: block withdraw if insufficient balance
    if (Number(user.balance || 0) < amount) {
      return res.status(400).json({ ok: false, error: "insufficient_balance", balance: user.balance || 0 });
    }

    // Insert withdrawal request
    const { data: w, error: wErr } = await supabase
      .from("withdrawals")
      .insert([{
        user_id: user.id,
        amount,
        status: "pending"
      }])
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
