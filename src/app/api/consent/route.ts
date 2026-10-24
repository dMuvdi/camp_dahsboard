import { sendCampEmail } from "@/lib/campEmail";
import { buildConsentPdf, type PdfSignature } from "@/lib/consentPdf";
import { adultParagraphs, fullName, minorClauses, minorParagraphs } from "@/lib/consentText";
import { notifyStaffSigned } from "@/lib/notifyStaff";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Signing endpoint for the consent pages (replaces the old Supabase Edge Functions). Public because signers aren't
// logged in: the person id in the link is the credential, and everything else is checked against the database.
//   kind=adult             person_id, signature            -> signed PDF
//   kind=minor             minor_id, manager_id, signature -> signed PDF (the parent goes to camp)
//   kind=delegate-request  minor_id, manager_id, tutor_name, tutor_national_id, signature -> emails the named adult
//   kind=delegate          minor_id, signature             -> signed PDF with the parent's and the manager's signatures

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

type Person = {
    id: string; names: string; last_name_1: string; last_name_2: string | null; national_id: string; age: number;
    email: string | null; manager_id: string | null; tutor_name: string | null; tutor_national_id: string | null;
};
const fields = "id, names, last_name_1, last_name_2, national_id, age, email, manager_id, tutor_name, tutor_national_id";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isMinor = (p: Person) => Number(p.age) < 18;
const idLabel = (p: Person) => `${isMinor(p) ? "T.I." : "C.C."} ${p.national_id}`;
const longDate = (d: Date) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(d);

type Db = ReturnType<typeof supabaseAdmin>;

async function loadPerson(db: Db, id: FormDataEntryValue | string | null): Promise<Person> {
    if (typeof id !== "string" || !uuid.test(id)) throw new HttpError(400, "Enlace de firma no válido.");
    const { data, error } = await db.from("People").select(fields).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "No encontramos a este participante.");
    return data as Person;
}

async function signatureFrom(form: FormData): Promise<Uint8Array> {
    const file = form.get("signature");
    if (!(file instanceof File) || file.size === 0 || file.size > 1_500_000) throw new HttpError(400, "La firma no llegó bien. Vuelve a firmar.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    // only PNGs from the signature pad
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) throw new HttpError(400, "La firma no llegó bien. Vuelve a firmar.");
    return bytes;
}

const text = (form: FormData, key: string, max: number) => {
    const value = form.get(key);
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed || trimmed.length > max) throw new HttpError(400, "Faltan datos del padre, madre o tutor(a).");
    return trimmed;
};

// White logos for the PDF header, from the public assets bucket (kept in memory per server instance)
let logoCache: Promise<{ camp: Uint8Array; vida: Uint8Array }> | null = null;
function logos() {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/logos`;
    const get = async (file: string) => {
        const res = await fetch(`${base}/${file}`);
        if (!res.ok) throw new Error(`Logo ${file}: HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
    };
    logoCache ??= Promise.all([get("revelation_camp_logo_white.PNG"), get("vida_logo_white.PNG")])
        .then(([camp, vida]) => ({ camp, vida }))
        .catch((e) => {
            logoCache = null;
            throw e;
        });
    return logoCache;
}

// Stores the PDF, marks the person signed, emails their boarding pass and tells staff
async function finish(db: Db, person: Person, pdf: Uint8Array, origin: string, update: Record<string, unknown> = {}) {
    const path = `consent_${person.id}_${Date.now()}.pdf`;
    const { error: uploadError } = await db.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (uploadError) throw uploadError;
    const { publicUrl } = db.storage.from("documents").getPublicUrl(path).data;
    const { error } = await db.from("People").update({ ...update, document_url: publicUrl, has_signed: true }).eq("id", person.id);
    if (error) throw error;

    const [ticket, push] = await Promise.allSettled([
        person.email
            ? sendCampEmail({ emailType: "ticket", to: person.email, fullName: fullName(person), userId: person.id, origin })
            : Promise.reject(new Error("Participant has no email")),
        notifyStaffSigned(person),
    ]);
    if (ticket.status === "rejected") console.error("consent: ticket email failed", ticket.reason);
    if (push.status === "rejected") console.error("consent: staff push failed", push.reason);
}

const pdfResponse = (pdf: Uint8Array) =>
    new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const kind = form.get("kind");
        const db = supabaseAdmin();
        const origin = new URL(req.url).origin;
        const now = new Date();

        if (kind === "adult") {
            const person = await loadPerson(db, form.get("person_id"));
            if (isMinor(person)) throw new HttpError(400, "Este participante es menor de edad: lo firma su padre, madre o tutor(a).");
            const signature = await signatureFrom(form);
            const pdf = await buildConsentPdf({
                paragraphs: adultParagraphs({ name: fullName(person), nationalId: person.national_id, date: longDate(now) }),
                signatures: [{ image: signature, name: fullName(person), idLabel: idLabel(person), caption: "Firma del participante" }],
                signedAt: now,
                documentId: person.id,
                logos: await logos(),
            });
            await finish(db, person, pdf, origin);
            return pdfResponse(pdf);
        }

        if (kind === "minor" || kind === "delegate-request") {
            const minor = await loadPerson(db, form.get("minor_id"));
            const manager = await loadPerson(db, form.get("manager_id"));
            if (!isMinor(minor)) throw new HttpError(400, "Este participante ya es mayor de edad: firma su propio consentimiento.");
            if (isMinor(manager) || manager.id === minor.id) throw new HttpError(400, "El responsable debe ser un adulto inscrito en el campamento.");
            const signature = await signatureFrom(form);

            if (kind === "minor") {
                const pdf = await buildConsentPdf({
                    paragraphs: minorParagraphs({ tutorName: fullName(manager), tutorNationalId: manager.national_id, minorName: fullName(minor), minorNationalId: minor.national_id }),
                    clauses: minorClauses({ option: "parent" }),
                    signatures: [{ image: signature, name: fullName(manager), idLabel: idLabel(manager), caption: "Firma del padre, madre o tutor(a)" }],
                    signedAt: now,
                    documentId: minor.id,
                    logos: await logos(),
                });
                await finish(db, minor, pdf, origin, { manager_id: manager.id, tutor_name: fullName(manager), tutor_national_id: manager.national_id });
                return pdfResponse(pdf);
            }

            // The parent signs now; the PDF is made when the named adult signs too (kind=delegate)
            const tutorName = text(form, "tutor_name", 120);
            const tutorNationalId = text(form, "tutor_national_id", 20);
            if (tutorNationalId === manager.national_id) throw new HttpError(400, "Si tú vas al campamento, elige «Yo voy al campamento».");
            const { error: sigError } = await db.storage.from("signatures").upload(`${minor.id}/parent.png`, signature, { contentType: "image/png", upsert: true });
            if (sigError) throw sigError;
            const { error } = await db.from("People")
                .update({ manager_id: manager.id, tutor_name: tutorName, tutor_national_id: tutorNationalId, has_signed: false })
                .eq("id", minor.id);
            if (error) throw error;

            const link = `${origin}/delegate_signature/${minor.id}`;
            let delegateNotified = false;
            if (manager.email) {
                try {
                    await sendCampEmail({ emailType: "contract", to: manager.email, fullName: fullName(manager), userId: manager.id, origin, contractUrl: link, minorName: fullName(minor) });
                    delegateNotified = true;
                } catch (e) {
                    console.error("consent: delegate email failed", e);
                }
            }
            return Response.json({ delegateNotified, link, delegateName: fullName(manager) });
        }

        if (kind === "delegate") {
            const minor = await loadPerson(db, form.get("minor_id"));
            if (!minor.manager_id || !minor.tutor_name || !minor.tutor_national_id) throw new HttpError(409, "Falta la autorización del padre, madre o tutor(a).");
            const manager = await loadPerson(db, minor.manager_id);
            const { data: parentSignature, error: sigError } = await db.storage.from("signatures").download(`${minor.id}/parent.png`);
            if (sigError || !parentSignature) throw new HttpError(409, "Falta la firma del padre, madre o tutor(a). Pídele que vuelva a firmar la autorización.");
            const signature = await signatureFrom(form);
            const signatures: PdfSignature[] = [
                { image: new Uint8Array(await parentSignature.arrayBuffer()), name: minor.tutor_name, idLabel: `C.C. ${minor.tutor_national_id}`, caption: "Firma del padre, madre o tutor(a)" },
                { image: signature, name: fullName(manager), idLabel: idLabel(manager), caption: "Firma del responsable en el campamento" },
            ];
            const pdf = await buildConsentPdf({
                paragraphs: minorParagraphs({ tutorName: minor.tutor_name, tutorNationalId: minor.tutor_national_id, minorName: fullName(minor), minorNationalId: minor.national_id }),
                clauses: minorClauses({ option: "delegate", delegateName: fullName(manager), delegateNationalId: manager.national_id }),
                signatures,
                signedAt: now,
                documentId: minor.id,
                logos: await logos(),
            });
            await finish(db, minor, pdf, origin);
            return pdfResponse(pdf);
        }

        throw new HttpError(400, "Tipo de firma no válido.");
    } catch (e) {
        if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
        console.error("consent route failed", e);
        return Response.json({ error: "No se pudo registrar la firma. Intenta de nuevo en unos minutos." }, { status: 500 });
    }
}
