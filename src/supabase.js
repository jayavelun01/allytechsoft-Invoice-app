// Supabase client — initialised once and shared across the app.
// Env vars come from Vite (.env.local locally, build-time vars on Hostinger).

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Surface this loudly during dev so it's not a mystery later.
  // eslint-disable-next-line no-console
  console.error(
    '[AllyTechSoft Invoice] Missing Supabase env variables.\n' +
      'Copy .env.example to .env.local and fill in:\n' +
      '  VITE_SUPABASE_URL=...\n' +
      '  VITE_SUPABASE_ANON_KEY=...',
  )
}

export const supabase = createClient(url || '', key || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Returns the current authenticated user's ID (uuid), or throws if not signed in. */
export async function requireUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}
