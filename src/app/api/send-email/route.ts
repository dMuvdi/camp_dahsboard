import { sendCampEmail } from "@/lib/campEmail";
import { supabaseAdmin, staffUser } from "@/lib/supabaseAdmin";
import { fullName } from "@/components/ConsentDocument";

export const runtime = "nodejs";

const personFields = "id, names, last_name_1, last_name_2, email";

// Staff resend of the consent link or the boarding pass. The recipient always comes from the database.
export async function POST(req: Request) {
    const { userId, emailType = "ticket" } = await req.json().catch(() => ({}));
    if (typeof userId !== "string") {
        return Response.json({ error: "Missing 'userId'" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const origin = new URL(req.url).origin;

    try {
        if (!(await staffUser(req))) {
            return Response.json({ error: "Sign in as staff to send emails" }, { status: 401 });
        }

        const { data: person } = await db.from("People").select(personFields).eq("id", userId).maybeSingle();
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
