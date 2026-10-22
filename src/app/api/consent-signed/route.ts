import { sendCampEmail } from "@/lib/campEmail";
import { notifyStaffSigned } from "@/lib/notifyStaff";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fullName } from "@/components/ConsentDocument";

export const runtime = "nodejs";

// Last step of a signature: marks the person as signed, emails their boarding pass and tells staff.
// Public because signers aren't logged in, so it trusts the database, not the caller.
export async function POST(req: Request) {
    const { personId } = await req.json().catch(() => ({}));
    if (typeof personId !== "string") {
        return Response.json({ error: "Missing 'personId'" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: person } = await db
        .from("People")
        .select("id, names, last_name_1, last_name_2, email, document_url")
        .eq("id", personId)
        .maybeSingle();

    // The Edge Functions store the signed PDF before answering, so a document is the proof of signature.
    // shortcut: a repeated call re-sends the ticket to the person's own email; add a signed_at check if it gets abused
    if (!person?.document_url) {
        return Response.json({ error: "No signed document for this person" }, { status: 409 });
    }

    const { error } = await db.from("People").update({ has_signed: true }).eq("id", person.id);
    if (error) {
        console.error("consent-signed: update failed", error);
        return Response.json({ error: "Could not update the participant" }, { status: 500 });
    }

    const [ticket, push] = await Promise.allSettled([
        person.email
            ? sendCampEmail({ emailType: "ticket", to: person.email, fullName: fullName(person), userId: person.id, origin: new URL(req.url).origin })
            : Promise.reject(new Error("Participant has no email")),
        notifyStaffSigned(person),
    ]);
    if (ticket.status === "rejected") console.error("consent-signed: ticket email failed", ticket.reason);
    if (push.status === "rejected") console.error("consent-signed: staff push failed", push.reason);

    return Response.json({ ticketSent: ticket.status === "fulfilled" });
}
