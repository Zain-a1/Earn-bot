// api/withdrawals.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const telegram_id = String(req.query.telegram_id || "").trim();
    if (!telegram_id) return res.status(400).json({ ok: false, error: "missing_telegram_id" });

    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .single();

    if (uErr || !user) return res.status(404).json({ ok: false, error: "user_not_found" });

    const { data, error } = await supabase
      .from("withdrawals")
      .select("id, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ ok: false, error: "withdrawals_fetch_failed" });

    return res.status(200).json({ ok: true, withdrawals: data || [] });
  } catch (e) {
    console.error("api/withdrawals crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
