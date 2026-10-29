// Environment variable in Supabase Edge Functions (Deno) and in Next.js / scripts (Node)
export function env(key: string): string | undefined {
    const deno = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
    if (deno) return deno.env.get(key);
    return typeof process !== "undefined" ? process.env[key] : undefined;
}
