import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: safe JSON
function safeJson(x) {
  try { return JSON.stringify(x); } catch { return String(x); }
}

export default async function handler(req, res) {
  // Telegram only needs a 200 response. Always return 200.
  try {
    const update = req.body || {};

    // OPTIONAL: store raw update for debugging (creates visibility)
    // If you don't want logs, you can remove this whole block.
    await supabase.from("webhook_logs").insert([
      {
        raw: safeJson(update),
        created_at: new Date().toISOString(),
      },
    ]).catch(() => {});

    // Try to extract user info (works for /start, messages, etc.)
    const msg = update.message || update.edited_message || update.callback_query?.message;
    const from = msg?.from || update.callback_query?.from;

    const telegram_id = from?.id;
    const username = from?.username || null;

    // If we got a telegram_id, ensure user exists
    if (telegram_id) {
      const { data: existing } = await supabase
        .from("users")
        .select("id, telegram_id")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("users").insert([
          { telegram_id, username, balance: 0 }
        ]);
      }
    }

    // Always OK
    return res.status(200).send("OK");
  } catch (e) {
    // Even on error, return 200 so Telegram stops failing
    return res.status(200).send("OK");
  }
}
