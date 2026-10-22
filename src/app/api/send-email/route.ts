import { sendCampEmail } from "@/lib/campEmail";
import { supabaseAdmin, staffUser } from "@/lib/supabaseAdmin";
import { fullName } from "@/components/ConsentDocument";

export const runtime = "nodejs";

const personFields = "id, names, last_name_1, last_name_2, email, manager_id";

// Staff resend of the consent link or the boarding pass. The recipient always comes from the database.
export async function POST(req: Request) {
    const { userId, emailType = "ticket", contractUrl } = await req.json().catch(() => ({}));
    if (typeof userId !== "string") {
        return Response.json({ error: "Missing 'userId'" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const origin = new URL(req.url).origin;

    try {
        // Link for the adult a parent named as a minor's manager. Kept open because the minor flow's Edge Function may call
        // it; it can only reach the manager stored for that minor.
        const delegateMinorId = typeof contractUrl === "string" ? contractUrl.match(/\/delegate_signature\/([0-9a-f-]{36})/i)?.[1] : undefined;
        if (emailType === "contract" && delegateMinorId) {
            const { data: minor } = await db.from("People").select("id, manager_id").eq("id", delegateMinorId).maybeSingle();
            const { data: manager } = minor?.manager_id
                ? await db.from("People").select(personFields).eq("id", minor.manager_id).maybeSingle()
                : { data: null };
            if (!minor || !manager?.email) {
                return Response.json({ error: "Manager not found" }, { status: 404 });
            }
            await sendCampEmail({ emailType: "contract", to: manager.email, fullName: fullName(manager), userId: manager.id, origin, contractUrl: `${origin}/delegate_signature/${minor.id}` });
            return Response.json({ ok: true });
        }

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
