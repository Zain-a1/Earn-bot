// api/webhook.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function tgSend(chatId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN missing (no replies will be sent).");
    return;
  }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = await r.json().catch(() => ({}));
  if (!data.ok) console.error("Telegram sendMessage failed:", data);
}

export default async function handler(req, res) {
  // Telegram expects quick 200s; we always return 200 and log failures.
  if (req.method !== "POST") return res.status(200).send("ok");

  try {
    const update = req.body ?? {};
    const msg = update.message;
    if (!msg?.from) return res.status(200).json({ ok: true });

    const telegram_id = String(msg.from.id);
    const chat_id = msg.chat?.id;
    const username = msg.from.username || null;
    const first_name = msg.from.first_name || null;
    const last_name = msg.from.last_name || null;
    const text = (msg.text || "").trim();

    console.log("Webhook hit:", { telegram_id, username, text });

    // ✅ IMPORTANT: this prevents duplicate-key crashes
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

    if (text === "/start" || text.toLowerCase() === "start") {
      await tgSend(chat_id, "✅ Registered. Send /balance to check your balance.");
    } else if (text === "/balance") {
      const { data, error } = await supabase
        .from("users")
        .select("balance")
        .eq("telegram_id", telegram_id)
        .single();

      if (error) {
        console.error("Balance query error:", error);
        await tgSend(chat_id, "⚠️ Could not load balance yet.");
      } else {
        await tgSend(chat_id, `💰 Balance: ${data?.balance ?? 0}`);
      }
    } else {
      await tgSend(chat_id, "Type /start or /balance.");
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Webhook crash:", e);
    return res.status(200).json({ ok: true });
  }
}
