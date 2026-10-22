import { createClient } from '@supabase/supabase-js'

// Server-only client with the service role key: bypasses RLS, so never import it from a 'use client' file.
// The key has no NEXT_PUBLIC_ prefix, so it can't reach the browser bundle.
export function supabaseAdmin() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

// Signed-in staff member behind an "Authorization: Bearer <access token>" header, or null
export async function staffUser(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    const { data, error } = await supabaseAdmin().auth.getUser(token)
    return error ? null : data.user
}
