import type { SupabaseClient } from "@supabase/supabase-js";
import { camp } from "./camp.ts";
import { env } from "./env.ts";
import { sendPush } from "./webpush.ts";

// Pushes "consent signed" to every staff device with notifications on. Skips quietly when push isn't configured.
// db: a service role client (the consent Edge Function), since staff devices belong to other users
export async function notifyStaffSigned(db: SupabaseClient, person: { names: string; last_name_1: string }) {
    const publicKey = env("VAPID_PUBLIC_KEY");
    const privateKey = env("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) return;

    const { data: subscriptions, error } = await db.from("push_subscriptions").select("endpoint, p256dh, auth");
    if (error) throw error;

    const payload = {
        title: "Consent signed",
        body: `${person.names} ${person.last_name_1} signed the ${camp.name} consent.`,
        url: "/dashboard",
    };
    const vapid = { publicKey, privateKey, subject: `mailto:${camp.contactEmail}` };
    const results = await Promise.allSettled(
        (subscriptions ?? []).map(async (s) => ({ endpoint: s.endpoint, status: await sendPush(s, payload, vapid) })),
    );

    // 404/410: the browser dropped the subscription, so stop sending to it
    const gone = results.flatMap((r) => (r.status === "fulfilled" && (r.value.status === 404 || r.value.status === 410) ? [r.value.endpoint] : []));
    if (gone.length) {
        await db.from("push_subscriptions").delete().in("endpoint", gone);
    }
    const failed = results.filter((r) => r.status === "rejected" || (r.value.status >= 400 && !gone.includes(r.value.endpoint)));
    if (failed.length) {
        console.error("notifyStaffSigned: some pushes failed", failed);
    }
}
