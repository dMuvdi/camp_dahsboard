import { notFound } from "next/navigation";
import { getSigningPerson } from "@/lib/consentApi";
import DelegateSignClient from "@/app/delegate_signature/[id]/DelegateSignClient";

export const dynamic = "force-dynamic";

export default async function DelegateSignaturePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    // Signers aren't logged in: the consent Edge Function reads the minor and their manager
    const data = await getSigningPerson(decodeURIComponent(id));

    if (!data) {
        notFound();
    }

    return <DelegateSignClient minor={data.person} manager={data.manager} />;
}
