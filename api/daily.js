// api/daily.js (ESM)

import { createClient } from "@supabase/supabase-js";
import { requireTelegramWebApp } from "./_tg-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_REWARD = 1000; // points per day

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // ✅ Only allow when opened inside Telegram WebApp (verified initData)
    const tg = requireTelegramWebApp(req, res);
    if (!tg) return;

    const telegram_id = tg.telegram_id;

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("telegram_id,balance,last_daily_claim")
      .eq("telegram_id", telegram_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    const now = new Date();

    if (user.last_daily_claim) {
      const last = new Date(user.last_daily_claim);
      const diffHours = (now - last) / (1000 * 60 * 60);

      if (diffHours < 24) {
        return res.status(400).json({
          ok: false,
          error: "already_claimed",
          hours_remaining: Number(24 - diffHours).toFixed(2),
        });
      }
    }

    // Update balance + claim time
    const newBalance = Number(user.balance || 0) + DAILY_REWARD;

    const { error: updateError } = await supabase
      .from("users")
      .update({
        balance: newBalance,
        last_daily_claim: now,
      })
      .eq("telegram_id", telegram_id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    return res.status(200).json({
      ok: true,
      reward: DAILY_REWARD,
      balance: newBalance,
    });
  } catch (err) {
    console.error("Daily bonus error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
