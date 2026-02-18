import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("Webhook hit");

  try {
    const update = req.body;

    console.log("Body:", JSON.stringify(update));

    if (!update.message) {
      return res.status(200).send("OK");
    }

    const telegram_id = update.message.from.id;
    const username = update.message.from.username || null;

    console.log("User:", telegram_id);
await supabase
  .from("users")
  .upsert(
    [{
      telegram_id: String(telegram_id),
      username: username,
      balance: 0
    }],
    { onConflict: "telegram_id" }
  );
    const { error } = await supabase.from("users").insert([
      {
        telegram_id: telegram_id,
        username: username,
        balance: 0
      }
    ]);

    if (error) {
      console.error("Supabase error:", error);
    } else {
      console.log("Inserted successfully");
    }

    return res.status(200).send("OK");

  } catch (err) {
    console.error("Server error:", err);
    return res.status(200).send("OK");
  }
}
