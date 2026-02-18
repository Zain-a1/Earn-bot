// api/webhook.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function tgSend(chat_id, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN missing. Bot cannot reply.");
    return;
  }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text }),
  });

  const data = await r.json().catch(() => ({}));
  if (!data.ok) {
    console.error("Telegram sendMessage failed:", data);
  }
}

module.exports = async function handler(req, res) {
  // Telegram wants 200 quickly. Always respond 200 (log errors instead).
  if (req.method !== "POST") return res.status(200).send("ok");

  try {
    const update = req.body || {};
    const msg = update.message;

    if (!msg || !msg.from) return res.status(200).json({ ok: true });

    const telegram_id = String(msg.from.id);
    const username = msg.from.username || null;
    const first_name = msg.from.first_name || null;
    const last_name = msg.from.last_name || null;
    const text = (msg.text || "").trim();

    console.log("Webhook hit:", { telegram_id, username, text });

    // ✅ ONLY UPSERT (NO INSERT ANYWHERE)
    // IMPORTANT: onConflict must match your exact column name: telegram_id
    const { error: upsertErr } = await supabase
      .from("users")
      .upsert(
        [
          {
            telegram_id,
            username,
            first_name,
            last_name,
            // Don't force balance back to 0 every time:
            // Only set balance=0 when creating the user (handled below optionally),
          },
        ],
        { onConflict: "telegram_id" }
      );

    if (upsertErr) {
      console.error("Supabase upsert error:", upsertErr);
      // still return 200 to stop Telegram retry-loop
      return res.status(200).json({ ok: true });
    }

    // If /start -> reply
    if (text === "/start" || text.toLowerCase() === "start") {
      await tgSend(msg.chat.id, "✅ Registered.\n\nUse /balance to check balance.");
    } else if (text === "/balance") {
      const { data, error } = await supabase
        .from("users")
        .select("balance")
        .eq("telegram_id", telegram_id)
        .single();

      if (error) {
        console.error("Balance select error:", error);
        await tgSend(msg.chat.id, "⚠️ Could not load balance yet.");
      } else {
        await tgSend(msg.chat.id, `💰 Balance: ${data.balance ?? 0}`);
      }
    } else {
      // optional default
      await tgSend(msg.chat.id, "Send /balance or /start.");
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Webhook crash:", e);
    return res.status(200).json({ ok: true });
  }
};
