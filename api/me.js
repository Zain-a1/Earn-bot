// api/me.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Allow GET only
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const telegram_id = String(req.query.telegram_id || "").trim();
    if (!telegram_id) return res.status(400).json({ ok: false, error: "missing_telegram_id" });

    const { data, error } = await supabase
      .from("users")
      .select("id, telegram_id, username, first_name, last_name, balance, created_at")
      .eq("telegram_id", telegram_id)
      .single();

    if (error) {
      // If user doesn't exist, tell frontend clearly
      return res.status(404).json({ ok: false, error: "user_not_found", details: error.message });
    }

    return res.status(200).json({ ok: true, user: data });
  } catch (e) {
    console.error("api/me crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
