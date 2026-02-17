
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { telegram_id, username } = req.body

  if (!telegram_id) {
    return res.status(400).json({ error: 'Missing telegram_id' })
  }

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
        username: username || null,
        balance: 0
      }
    ])
  }

  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('telegram_id', telegram_id)
    .single()

  return res.status(200).json({
    message: 'User synced',
    balance: user.balance
  })
}
