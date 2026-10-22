import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Signing page check that a C.C. belongs to a registered camper. Exact match only, and just the fields the form shows.
// shortcut: no rate limit, so someone could probe C.C. numbers for names; add one if the landing draws abuse
export async function POST(req: Request) {
    const { nationalId } = await req.json().catch(() => ({}));
    const id = typeof nationalId === "string" ? nationalId.trim() : "";
    if (!/^[0-9A-Za-z-]{4,20}$/.test(id)) {
        return Response.json({ error: "Invalid national ID" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
        .from("People")
        .select("id, names, last_name_1, last_name_2, age")
        .eq("national_id", id)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error("camper-lookup failed", error);
        return Response.json({ error: "Lookup failed" }, { status: 500 });
    }
    return data ? Response.json(data) : Response.json({ error: "Not found" }, { status: 404 });
}
