import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send("OK")
  }

  const update = req.body

  if (!update.message) {
    return res.status(200).send("No message")
  }

  const telegram_id = update.message.from.id
  const username = update.message.from.username || null
  const text = update.message.text || ""

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegram_id)
    .single()

  if (!existingUser) {
    await supabase.from('users').insert([
      {
        telegram_id,
        username,
        balance: 0
      }
    ])
  }

  return res.status(200).send("OK")
}
