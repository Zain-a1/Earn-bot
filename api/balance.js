// api/balance.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const telegram_id = String(req.query.telegram_id || "").trim();
    if (!telegram_id) {
      return res.status(400).json({ error: "Missing telegram_id" });
    }

    // 1) Fetch user
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, telegram_id, username, first_name, last_name, balance, created_at")
      .eq("telegram_id", telegram_id)
      .single();

    if (userErr) {
      return res.status(404).json({ error: "User not found", details: userErr.message });
    }

    // 2) Count pending withdrawals for this user
    const { count: pendingCount, error: pendingErr } = await supabase
      .from("withdrawals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (pendingErr) {
      // still return user even if count fails
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
    return res.status(500).json({ error: "Server error" });
  }
}
