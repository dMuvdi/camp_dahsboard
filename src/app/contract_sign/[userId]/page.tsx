import { notFound } from "next/navigation";
import { supabase, type User } from "@/lib/supabase";
import ContractSignClient from "@/app/contract_sign/[userId]/ContractSignClient";

export const dynamic = "force-dynamic";

async function fetchParticipant(userId: string): Promise<User | null> {
    if (!userId) {
        return null;
    }

    const { data, error } = await supabase
        .from("People")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !data) {
        console.error("Failed to fetch participant", error);
        return null;
    }

    return data as User;
}

export default async function ContractSignPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await params;
    const decodedUserId = decodeURIComponent(userId);
    const participant = await fetchParticipant(decodedUserId);

    if (!participant) {
        notFound();
    }

    return <ContractSignClient participant={participant} />;
}


