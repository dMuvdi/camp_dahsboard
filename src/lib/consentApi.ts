import type { User } from "@/lib/supabase";

// The "consent" Supabase Edge Function (supabase/functions/consent) does every step that needs elevated access;
// the web app calls it with the public anon key and never holds the service role key.
export const consentFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/consent`;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const consentHeaders = { Authorization: `Bearer ${anon}`, apikey: anon };

// Server side: the row a signing link points to (and the minor's manager), or null when the link is wrong
export async function getSigningPerson(id: string): Promise<{ person: User; manager: User | null } | null> {
    const res = await fetch(consentFunctionUrl, {
        method: "POST",
        headers: { ...consentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "person", id }),
        cache: "no-store",
    });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error(`consent function: HTTP ${res.status}`);
    return res.json();
}
