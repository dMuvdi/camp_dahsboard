import { notFound } from "next/navigation";
import { supabase, type User } from "@/lib/supabase";
import DelegateSignClient from "@/app/delegate_signature/[id]/DelegateSignClient";

export const dynamic = "force-dynamic";

async function fetchMinor(minorId: string): Promise<User | null> {
    if (!minorId) {
        return null;
    }

    const { data, error } = await supabase
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

    return <DelegateSignClient minor={minor} />;
}

