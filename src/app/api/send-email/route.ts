import { createClient } from "@supabase/supabase-js";
import { sendCampEmail } from "@/lib/campEmail";
import { fullName } from "@/lib/consentText";

export const runtime = "nodejs";

// Staff resend of the consent link or the boarding pass. Runs as the signed-in staff member (their access token
// with the anon key), so the same RLS rules as the dashboard apply and no service role key is needed here.
// The recipient always comes from the database, never from the request.
export async function POST(req: Request) {
    const { userId, emailType = "ticket" } = await req.json().catch(() => ({}));
    if (typeof userId !== "string") {
        return Response.json({ error: "Missing 'userId'" }, { status: 400 });
    }

    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
        return Response.json({ error: "Sign in as staff to send emails" }, { status: 401 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const origin = new URL(req.url).origin;

    try {
        const { error: authError } = await db.auth.getUser(token);
        if (authError) {
            return Response.json({ error: "Sign in as staff to send emails" }, { status: 401 });
        }

        const { data: person } = await db.from("People").select("id, names, last_name_1, last_name_2, email").eq("id", userId).maybeSingle();
        if (!person?.email) {
            return Response.json({ error: "Participant not found or without email" }, { status: 404 });
        }
        const isContract = emailType === "contract";
        await sendCampEmail({
            emailType: isContract ? "contract" : "ticket",
            to: person.email,
            fullName: fullName(person),
            userId: person.id,
            origin,
            contractUrl: isContract ? `${origin}/contract_sign/${person.id}` : undefined,
        });
        return Response.json({ ok: true });
    } catch (error) {
        console.error("send-email route error", error);
        return Response.json({ error: "Failed to send" }, { status: 500 });
    }
}
