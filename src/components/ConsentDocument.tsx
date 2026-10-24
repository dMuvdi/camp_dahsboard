import { Fragment } from "react";
import type { User } from "@/lib/supabase";
import { adultParagraphs, minorClauses, minorParagraphs, fullName, type Paragraph } from "@/lib/consentText";

export { consentTitle, fullName } from "@/lib/consentText";

// Renders the shared legal text (lib/consentText) on the signing pages; the PDF draws the same paragraphs.

// A form value inside the document: bold when filled, a blank line like the paper version when not.
function Filled({ value }: { value?: string }) {
    if (value) return <strong className="font-semibold text-ink">{value}</strong>;
    return (
        <span className="inline-block w-36 border-b border-ink/50 align-baseline">
            <span className="sr-only">sin completar</span>&nbsp;
        </span>
    );
}

function Runs({ runs }: { runs: Paragraph }) {
    return runs.map((run, i) => (typeof run === "string" ? <Fragment key={i}>{run}</Fragment> : <Filled key={i} value={run.value} />));
}

const docClass = "space-y-4 text-ink/80 leading-relaxed";

export function AdultConsent({ person, date }: { person: User; date: string }) {
    return (
        <div className={docClass}>
            {adultParagraphs({ name: fullName(person), nationalId: person.national_id, date }).map((p, i) => (
                <p key={i}><Runs runs={p} /></p>
            ))}
        </div>
    );
}

interface MinorConsentProps {
    minor: User;
    tutorName?: string;
    tutorNationalId?: string;
    option: "parent" | "delegate" | null;
    delegateName?: string;
    delegateNationalId?: string;
}

export function MinorConsent({ minor, tutorName, tutorNationalId, option, delegateName, delegateNationalId }: MinorConsentProps) {
    const paragraphs = minorParagraphs({ tutorName, tutorNationalId, minorName: fullName(minor), minorNationalId: minor.national_id });
    return (
        <div className={docClass}>
            {paragraphs.map((p, i) => (
                <p key={i}><Runs runs={p} /></p>
            ))}
            <ul className="space-y-3 pt-2">
                {minorClauses({ option, delegateName, delegateNationalId }).map((clause, i) => (
                    <li key={i} className="flex gap-3">
                        <span
                            className={`mt-1 flex h-5 w-5 flex-none items-center justify-center rounded border ${clause.checked ? "border-oxblood bg-oxblood text-parchment" : "border-ink/40 bg-white"}`}
                            aria-hidden="true"
                        >
                            {clause.checked && (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </span>
                        <span>
                            <span className="sr-only">{clause.checked ? "Opción elegida: " : "Opción no elegida: "}</span>
                            <Runs runs={clause.text} />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
