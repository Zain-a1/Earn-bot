// api/request-withdrawal.js (ESM)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function toInt(x) {
  const n = Number(String(x ?? "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const telegram_id = String(body.telegram_id || "").trim();
    const amount_points = toInt(body.amount_points);
    const address = String(body.address || "").trim();

    // amount_usdt is optional (you may compute later)
    const amount_usdt_raw = body.amount_usdt;
    const amount_usdt =
      amount_usdt_raw === undefined || amount_usdt_raw === null || amount_usdt_raw === ""
        ? null
        : Number(amount_usdt_raw);

    if (!telegram_id) return res.status(400).json({ error: "Missing telegram_id" });
    if (!amount_points || amount_points <= 0)
      return res.status(400).json({ error: "Invalid amount_points" });
    if (!address) return res.status(400).json({ error: "Missing address" });

    // 1) Get user
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, balance")
      .eq("telegram_id", telegram_id)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2) Basic balance check (optional, but recommended)
    const current = Number(user.balance ?? 0);
    if (current < amount_points) {
      return res.status(400).json({
        error: "Insufficient points",
        points_balance: current,
      });
    }

    // 3) Insert withdrawal request (PENDING)
    // IMPORTANT:
    // - This assumes your withdrawals table has:
    //   user_id (bigint), amount_points (bigint/int), amount_usdt (numeric nullable),
    //   address (text), status (text), created_at timestamp default now()
    const { data: inserted, error: insErr } = await supabase
      .from("withdrawals")
      .insert([
        {
          user_id: user.id,
          amount_points,
          amount_usdt,
          address,
          status: "pending",
        },
      ])
      .select("*")
      .single();

    if (insErr) {
      console.error("withdraw insert error:", insErr);
      return res.status(500).json({ error: insErr.message });
    }

    return res.status(200).json({
      ok: true,
      withdrawal: inserted,
    });
  } catch (e) {
    console.error("request-withdrawal.js crash:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
