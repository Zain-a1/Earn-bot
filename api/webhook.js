// api/webhook.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WEB_APP_URL = "https://earn-bot-eight.vercel.app"; // your app URL

async function tgSendWebApp(chatId) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
              web_app: {
                url: "https://earn-bot-eight.vercel.app"
              }
            }
          ]
        ],
        resize_keyboard: true
      }
    })
  });
}

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🚀 Welcome!\n\nTap below to open the Earn App and start earning.",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔥 Open Earn App",
              web_app: {
                url: WEB_APP_URL
              }
            }
          ]
        ]
      }
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("ok");
  }

  try {
    const update = req.body ?? {};
    const msg = update.message;

    if (!msg?.from) {
      return res.status(200).json({ ok: true });
    }

    const text = (msg.text || "").trim().toLowerCase();
    const telegram_id = String(msg.from.id);
    const chat_id = msg.chat?.id;
    const username = msg.from.username || null;
    const first_name = msg.from.first_name || null;
    const last_name = msg.from.last_name || null;

    console.log("Webhook hit:", { telegram_id, username, text });

    // Register or update user
    const { error } = await supabase
      .from("users")
      .upsert(
        [{ telegram_id, username, first_name, last_name }],
        { onConflict: "telegram_id" }
      );

    if (error) {
      console.error("Supabase upsert error:", error);
      return res.status(200).json({ ok: true });
    }

    // ONLY send button when user types /start
    if (text === "/start") {
      await tgSendWebApp(chat_id);
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("Webhook crash:", e);
    return res.status(200).json({ ok: true });
  }
}
