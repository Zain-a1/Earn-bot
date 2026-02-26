// api/daily.js (ESM)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_REWARD = 1000; // points per day

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: "Missing telegram_id" });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();

    if (user.last_daily_claim) {
      const last = new Date(user.last_daily_claim);
      const diffHours = (now - last) / (1000 * 60 * 60);

      if (diffHours < 24) {
        return res.status(400).json({
          error: "Already claimed today",
          hours_remaining: (24 - diffHours).toFixed(2)
        });
      }
    }

    // Update balance + claim time
    const { error: updateError } = await supabase
      .from("users")
      .update({
        balance: user.balance + DAILY_REWARD,
        last_daily_claim: now
      })
      .eq("telegram_id", telegram_id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      success: true,
      reward: DAILY_REWARD
    });

  } catch (err) {
    console.error("Daily bonus error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
