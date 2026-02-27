// api/webhook.js (ESM)

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = "https://earn-bot-eight.vercel.app"; // change if needed

function generateLoginCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); 
  // 6 characters like: A3F9C2
}

async function sendLoginMessage(chatId, code) {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN missing");
    return;
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        `🔐 Your Login Code:\n\n` +
        `👉 ${code}\n\n` +
        `This code expires in 10 minutes.\n\n` +
        `Tap below to open the app and enter the code.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 Open Earn App",
              web_app: { url: WEB_APP_URL }
            }
          ]
        ]
      }
    })
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("ok");
    }

    const update = req.body;

    if (!update?.message?.from || !update?.message?.chat) {
      return res.status(200).json({ ok: true });
    }

    const msg = update.message;
    const chat_id = msg.chat.id;
    const telegram_id = String(msg.from.id);
    const text = (msg.text || "").trim().toLowerCase();

    console.log("Webhook hit:", telegram_id, text);

    // Register or update user
    await supabase
      .from("users")
      .upsert(
        [{
          telegram_id,
          username: msg.from.username || null,
          first_name: msg.from.first_name || null,
          last_name: msg.from.last_name || null
        }],
        { onConflict: "telegram_id" }
      );

    // Only respond to /start
    if (text === "/start") {

      const login_code = generateLoginCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save login code
      await supabase
        .from("users")
        .update({
          login_code,
          login_code_expires_at: expires.toISOString()
        })
        .eq("telegram_id", telegram_id);

      await sendLoginMessage(chat_id, login_code);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("WEBHOOK CRASH:", err);
    return res.status(200).json({ ok: true }); 
    // IMPORTANT: never return 500 to Telegram
  }
}
