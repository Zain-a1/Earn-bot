// api/cpx-postback.js (ESM)
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Put your CPX "Security Hash" in Vercel ENV as CPX_SECURITY_HASH
const CPX_SECURITY_HASH = process.env.CPX_SECURITY_HASH || "";

// Your economy: 10,000 points = $1
const POINTS_PER_USD = 10000;

function md5(s) {
  return crypto.createHash("md5").update(String(s)).digest("hex");
}

function asNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

export default async function handler(req, res) {
  try {
    // CPX calls via GET
    const q = req.query || {};

    const status = String(q.status || "");       // 1=completed, 2=reversed (per CPX UI)
    const trans_id = String(q.trans_id || "");
    const secure_hash = String(q.secure_hash || "");

    // We will pass telegram_id as subid_1
    const telegram_id = String(q.subid_1 || "");

    // REQUIRED by CPX warning banner
    const amount_usd = asNumber(q.amount_usd);
    const amount_local = q.amount_local; // not used for points, but included for CPX compliance

    if (!trans_id || !telegram_id) {
      return res.status(200).send("ok"); // don't error hard; CPX may retry
    }

    // Verify hash if configured
    if (CPX_SECURITY_HASH) {
      const expected = md5(trans_id + CPX_SECURITY_HASH);
      if (expected !== secure_hash) {
        // invalid signature
        return res.status(200).send("ok");
      }
    }

    if (!Number.isFinite(amount_usd) || amount_usd <= 0) {
      // no payout amount => nothing to credit
      return res.status(200).send("ok");
    }

    // Convert USD -> points
    const points = Math.round(amount_usd * POINTS_PER_USD);

    // --- Idempotency & reversal handling ---
    // You NEED a table to store trans_id so you don't double-credit.
    // Create table: cpx_events (recommended) OR reuse an existing "events" table if you have one.
    //
    // Minimal expected schema (recommended):
    // cpx_events: trans_id (text pk), telegram_id (text), status (text), amount_usd (numeric), points (int), created_at (timestamptz default now())
    //
    // We'll try to insert first; if it already exists, we won't credit again.

    // 1) Insert event if new
    const ins = await supabase
      .from("cpx_events")
      .insert([{
        trans_id,
        telegram_id,
        status,
        amount_usd,
        amount_local: amount_local ?? null,
        points
      }]);

    // If duplicate (already inserted), do nothing
    if (ins.error) {
      // If it's a duplicate key, ignore. Otherwise also ignore (don't break CPX).
      return res.status(200).send("ok");
    }

    // 2) If status=1 credit points, if status=2 reverse (optional)
    if (status === "1") {
      // credit
      await supabase.rpc("increment_user_balance_by_telegram", {
        p_telegram_id: telegram_id,
        p_delta: points
      });
    } else if (status === "2") {
      // reversal: subtract points (optional — only if you want reversals to remove balance)
      await supabase.rpc("increment_user_balance_by_telegram", {
        p_telegram_id: telegram_id,
        p_delta: -points
      });
    }

    return res.status(200).send("ok");
  } catch (e) {
    // Never let CPX see 500
    return res.status(200).send("ok");
  }
}
