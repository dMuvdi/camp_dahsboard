import { notFound } from "next/navigation";
import { getSigningPerson } from "@/lib/consentApi";
import ContractSignClient from "@/app/contract_sign/[userId]/ContractSignClient";

export const dynamic = "force-dynamic";

export default async function ContractSignPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await params;
    // Signers aren't logged in: the consent Edge Function reads the participant
    const data = await getSigningPerson(decodeURIComponent(userId));

    if (!data) {
        notFound();
    }

    return <ContractSignClient participant={data.person} />;
}
