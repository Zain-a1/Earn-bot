// api/webhook.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function tgSendWebApp(chatId) {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.error("BOT_TOKEN missing.");
    return;
  }

  const WEB_APP_URL = "https://earn-bot-eight.vercel.app"; // 🔴 REPLACE if needed

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🚀 Open the Earn App",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open App",
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

    const telegram_id = String(msg.from.id);
    const chat_id = msg.chat?.id;
    const username = msg.from.username || null;
    const first_name = msg.from.first_name || null;
    const last_name = msg.from.last_name || null;

    console.log("Webhook hit:", { telegram_id, username });

    // Keep user registration logic
    const { error: upsertErr } = await supabase
      .from("users")
      .upsert(
        [{ telegram_id, username, first_name, last_name }],
        { onConflict: "telegram_id" }
      );

    if (upsertErr) {
      console.error("Supabase upsert error:", upsertErr);
      return res.status(200).json({ ok: true });
    }

    // Always send Web App button
    await tgSendWebApp(chat_id);

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("Webhook crash:", e);
    return res.status(200).json({ ok: true });
  }
}
