// api/webhook.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = "https://earn-bot-eight.vercel.app";

async function sendWebAppButton(chatId) {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN missing");
    return;
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🚀 Tap below to open the Earn App:",
      reply_markup: {
        keyboard: [
          [
            {
              text: "🔥 Open Earn App",
              web_app: { url: WEB_APP_URL }
            }
          ]
        ],
        resize_keyboard: true
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

    // Handle only normal messages
    if (!update || !update.message) {
      return res.status(200).json({ ok: true });
    }

    const msg = update.message;

    if (!msg.from || !msg.chat) {
      return res.status(200).json({ ok: true });
    }

    const chat_id = msg.chat.id;
    const telegram_id = String(msg.from.id);
    const text = (msg.text || "").trim().toLowerCase();

    console.log("Webhook hit:", telegram_id, text);

    // Register user safely
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
      await sendWebAppButton(chat_id);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("WEBHOOK CRASH:", err);
    return res.status(200).json({ ok: true }); // NEVER let Telegram see 500
  }
}
