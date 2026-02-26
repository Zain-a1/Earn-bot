// api/withdrawals.js (ESM) — Telegram-only secure version
// ✅ Only works when called from Telegram WebApp (valid initData required)
// ✅ Does NOT trust telegram_id from URL (prevents people guessing IDs)

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyTelegramWebAppInitData(initData, botToken) {
  // Telegram WebApp initData verification:
  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  // hash = HMAC_SHA256(secret_key, data_check_string)
  if (!initData || typeof initData !== "string") return { ok: false, error: "missing_initdata" };
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

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqual(computedHash, hash)) {
    return { ok: false, error: "bad_initdata_signature" };
  }

  // Optional freshness check (keep simple: allow 24h)
  const authDate = Number(params.get("auth_date") || "0");
  if (authDate) {
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > 24 * 60 * 60) return { ok: false, error: "initdata_expired" };
  }

  // Extract user
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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // Frontend must send Telegram initData in a header.
    // Accept either header name (some people spell it differently).
    const initData =
      req.headers["x-telegram-initdata"] ||
      req.headers["x-telegram-init-data"] ||
      "";

    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    const gate = verifyTelegramWebAppInitData(String(initData || ""), botToken);

    if (!gate.ok) {
      return res.status(401).json({ ok: false, error: "not_from_telegram", details: gate.error });
    }

    const telegram_id = gate.telegram_id;

    // Lookup user
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .single();

    if (uErr || !user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    // Fetch withdrawals
    const { data, error } = await supabase
      .from("withdrawals")
      .select("id, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return res.status(500).json({ ok: false, error: "withdrawals_fetch_failed" });
    }

    return res.status(200).json({ ok: true, withdrawals: data || [] });
  } catch (e) {
    console.error("api/withdrawals crash:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
