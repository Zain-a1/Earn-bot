import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  try {
    const body = req.body;

    if (!body.message) {
      return res.status(200).json({ ok: true });
    }

    const telegram_id = body.message.from.id;
    const username = body.message.from.username || null;
    const first_name = body.message.from.first_name || null;
    const last_name = body.message.from.last_name || null;

    // ✅ SAFE UPSERT (NO DUPLICATE CRASH)
    const { error } = await supabase
      .from("users")
      .upsert(
        [
          {
            telegram_id: String(telegram_id),
            username: username,
            first_name: first_name,
            last_name: last_name,
            balance: 0
          }
        ],
        {
          onConflict: "telegram_id"
        }
      );

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // ✅ Reply to user
    const BOT_TOKEN = process.env.BOT_TOKEN;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: "✅ You are registered.\n\nUse /balance to check your balance."
      })
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
