// api/balance.js (ESM)
import { createClient } from "@supabase/supabase-js";
import { requireTelegramWebApp } from "./_tg-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // ✅ Only allow when opened inside Telegram WebApp (verified initData)
    const tg = requireTelegramWebApp(req, res);
    if (!tg) return;

    const telegram_id = tg.telegram_id;

    // 1) Fetch user
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, telegram_id, username, first_name, last_name, balance, created_at")
      .eq("telegram_id", telegram_id)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ ok: false, error: "user_not_found", details: userErr?.message });
    }

    // 2) Count pending withdrawals for this user
    const { count: pendingCount, error: pendingErr } = await supabase
      .from("withdrawals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (pendingErr) {
      return res.status(200).json({
        ok: true,
        user,
        points_balance: user.balance ?? 0,
        pending_withdrawals: 0,
        warning: pendingErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      user,
      points_balance: user.balance ?? 0,
      pending_withdrawals: pendingCount ?? 0,
    });
  } catch (e) {
    console.error("balance.js crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
