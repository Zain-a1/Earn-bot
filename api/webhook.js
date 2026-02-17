import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    const update = req.body;

    if (!update) {
      return res.status(200).send("No body");
    }

    const message = update.message;
    if (!message) {
      return res.status(200).send("No message");
    }

    const telegram_id = message.from.id;
    const username = message.from.username || null;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (!existingUser) {
      await supabase.from("users").insert([
        {
          telegram_id,
          username,
          balance: 0,
        },
      ]);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    return res.status(200).send("Error handled");
  }
}
