import { notFound } from "next/navigation";
import type { User } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DelegateSignClient from "@/app/delegate_signature/[id]/DelegateSignClient";

export const dynamic = "force-dynamic";

async function fetchMinor(minorId: string): Promise<User | null> {
    if (!minorId) {
        return null;
    }

    // Signers aren't logged in, so the page reads its one row on the server
    const { data, error } = await supabaseAdmin()
        .from("People")
        .select("*")
        .eq("id", minorId)
        .single();

    if (error || !data) {
        console.error("Failed to fetch minor", error);
        return null;
    }

    return data as User;
}

export default async function DelegateSignaturePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const minor = await fetchMinor(decodedId);

    if (!minor) {
        notFound();
    }

    const manager = minor.manager_id ? await fetchMinor(minor.manager_id) : null;

    return <DelegateSignClient minor={minor} manager={manager} />;
}

