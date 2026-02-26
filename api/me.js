// api/me.js (ESM) — Telegram-only secure version
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ----- helpers -----
function timingSafeEqual(a, b) {
  const ba = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyTelegramWebAppInitData(initData, botToken) {
  if (!initData || typeof initData !== "string")
    return { ok: false, error: "missing_initdata" };
  if (!botToken) return { ok: false, error: "missing_bot_token" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "missing_hash" };

  // Build data_check_string
  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push([key, value]);
  }
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  // Secret key = HMAC_SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // computedHash = HMAC_SHA256(secretKey, data_check_string)
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqual(computedHash, hash)) {
    return { ok: false, error: "bad_initdata_signature" };
  }

  // Optional freshness check (24h)
  const authDate = Number(params.get("auth_date") || "0");
  if (authDate) {
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > 24 * 60 * 60) return { ok: false, error: "initdata_expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "missing_user" };

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false, error: "bad_user_json" };
  }

  const telegram_id = user?.id ? String(user.id) : "";
  if (!telegram_id) return { ok: false, error: "missing_user_id" };

  return { ok: true, telegram_id, user };
}

// ----- handler -----
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // Must come from Telegram WebApp
    const initData =
      req.headers["x-telegram-initdata"] ||
      req.headers["x-telegram-init-data"] ||
      "";

    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    const gate = verifyTelegramWebAppInitData(String(initData || ""), botToken);

    if (!gate.ok) {
      return res
        .status(401)
        .json({ ok: false, error: "not_from_telegram", details: gate.error });
    }

    const telegram_id = gate.telegram_id;

    const { data, error } = await supabase
      .from("users")
      .select("id, telegram_id, username, first_name, last_name, balance, created_at")
      .eq("telegram_id", telegram_id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        ok: false,
        error: "user_not_found",
        details: error?.message || "not_found",
      });
    }

    return res.status(200).json({ ok: true, user: data });
  } catch (e) {
    console.error("api/me crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
