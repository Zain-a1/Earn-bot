// api/_tg-auth.js (ESM)
// Verifies Telegram WebApp initData and extracts the real Telegram user.
// Client must send header: x-telegram-initdata

import crypto from "crypto";

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

function buildDataCheckString(dataObj) {
  // Exclude hash
  const pairs = Object.entries(dataObj)
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return pairs.join("\n");
}

function hmacSha256Hex(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

export function requireTelegramWebApp(req, res) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ ok: false, error: "server_missing_bot_token" });
    return null;
  }

  const initData =
    (req.headers["x-telegram-initdata"] || req.headers["X-Telegram-InitData"] || "")
      .toString()
      .trim();

  if (!initData) {
    res.status(401).json({ ok: false, error: "not_opened_in_telegram" });
    return null;
  }

  const dataObj = parseInitData(initData);
  const receivedHash = dataObj.hash;
  if (!receivedHash) {
    res.status(401).json({ ok: false, error: "missing_hash" });
    return null;
  }

  // Optional: basic freshness check (prevents replay of very old initData)
  const authDate = Number(dataObj.auth_date || 0);
  if (!authDate) {
    res.status(401).json({ ok: false, error: "missing_auth_date" });
    return null;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const maxAgeSec = 60 * 60 * 24; // 24h
  if (nowSec - authDate > maxAgeSec) {
    res.status(401).json({ ok: false, error: "initdata_expired" });
    return null;
  }

  // Telegram verification:
  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  // check = HMAC_SHA256(data_check_string, secret_key)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const dataCheckString = buildDataCheckString(dataObj);
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== receivedHash) {
    res.status(401).json({ ok: false, error: "initdata_invalid" });
    return null;
  }

  // Extract user
  let user = null;
  try {
    user = dataObj.user ? JSON.parse(dataObj.user) : null;
  } catch {
    user = null;
  }

  if (!user?.id) {
    res.status(401).json({ ok: false, error: "missing_user" });
    return null;
  }

  return {
    telegram_id: String(user.id),
    user,
    auth_date: authDate,
  };
}
