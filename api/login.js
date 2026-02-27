// api/login.js (ESM)
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function randToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { code } = req.body || {};
    const login_code = String(code || "").trim();

    if (!login_code) {
      return res.status(400).json({ ok: false, error: "missing_code" });
    }

    const nowIso = new Date().toISOString();

    // Find user with this code, not expired
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id, telegram_id, login_code, login_code_expires_at")
      .eq("login_code", login_code)
      .gte("login_code_expires_at", nowIso)
      .single();

    if (uErr || !user) {
      return res.status(401).json({ ok: false, error: "invalid_or_expired_code" });
    }

    // Create session token (valid 30 days)
    const session_token = randToken(24);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const { error: upErr } = await supabase
      .from("users")
      .update({
        session_token,
        session_expires_at: expires.toISOString(),
        login_code: null,
        login_code_expires_at: null
      })
      .eq("id", user.id);

    if (upErr) {
      return res.status(500).json({ ok: false, error: "session_create_failed" });
    }

    return res.status(200).json({
      ok: true,
      session_token,
      session_expires_at: expires.toISOString()
    });
  } catch (e) {
    console.error("api/login crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
