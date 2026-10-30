"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/supabase";
import { camp } from "@/lib/camp";
import { consentFunctionUrl, consentHeaders } from "@/lib/consentApi";
import Wordmark from "@/components/Wordmark";
import { AdultConsent, MinorConsent, consentTitle, fullName } from "@/components/ConsentDocument";

interface ContractSignClientProps {
    participant: User;
}

interface SignatureState {
    hasDrawn: boolean;
    strokes: Path2D[];
}

// What the consent function's lookup returns for a registered camper
type Camper = Pick<User, "id" | "names" | "last_name_1" | "last_name_2" | "age">;

type Lookup =
    | { status: "idle" | "checking" }
    | { status: "error"; message: string }
    | { status: "found"; person: Camper };

const inputClass = "block h-12 w-full rounded-xl border border-ink/20 bg-white px-4 text-base text-ink placeholder-ink/40 focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/25";
const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

// Exact C.C. match, checked on the server (signers have no access to the participants table)
async function findPerson(nationalId: string): Promise<Camper | null> {
    const response = await fetch(consentFunctionUrl, {
        method: "POST",
        headers: { ...consentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", nationalId }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Lookup failed: ${response.status}`);
    return response.json();
}

// Debounced check that a C.C. belongs to an adult registered for the camp.
function usePersonLookup(nationalId: string, enabled: boolean, notFound: string): Lookup {
    const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
    useEffect(() => {
        const id = nationalId.trim();
        if (!enabled || !id) {
            setLookup({ status: "idle" });
            return;
        }
        let cancelled = false;
        setLookup({ status: "checking" });
        const handle = window.setTimeout(async () => {
            let next: Lookup;
            try {
                const person = await findPerson(id);
                next = !person
                    ? { status: "error", message: notFound }
                    : person.age < 18
                        ? { status: "error", message: "Esta cédula es de un menor de edad. El responsable debe ser mayor de edad." }
                        : { status: "found", person };
            } catch {
                next = { status: "error", message: "No pudimos verificar la cédula. Revisa tu conexión e intenta de nuevo." };
            }
            if (!cancelled) setLookup(next);
        }, 600);
        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [nationalId, enabled, notFound]);
    return lookup;
}

const lookupError = (lookup: Lookup) =>
    lookup.status === "found" ? null : lookup.status === "error" ? lookup.message : "Estamos verificando la cédula, espera un momento.";

function LookupNote({ lookup, id }: { lookup: Lookup; id: string }) {
    return (
        <div id={id} aria-live="polite" className="mt-2 min-h-5 text-sm">
            {lookup.status === "checking" && <p className="text-ink/60">Verificando…</p>}
            {lookup.status === "error" && <p className="font-semibold text-oxblood">{lookup.message}</p>}
            {lookup.status === "found" && (
                <p className="flex items-center gap-1.5 font-semibold text-glass">
                    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {fullName(lookup.person)} está inscrito(a) en el campamento
                </p>
            )}
        </div>
    );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section aria-labelledby={`step-${n}`} className="border-t border-ink/10 px-5 py-8 sm:px-8">
            <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-oxblood text-sm font-semibold text-parchment" aria-hidden="true">
                    {n}
                </span>
                <div>
                    <h2 id={`step-${n}`} className="text-lg font-semibold leading-8 text-ink">{title}</h2>
                    {hint && <p className="mt-0.5 text-sm text-ink/60">{hint}</p>}
                </div>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

const successIcon = (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-glass">
        <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    </div>
);

export default function ContractSignClient({
    participant,
}: ContractSignClientProps) {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signature, setSignature] = useState<SignatureState>({
        hasDrawn: false,
        strokes: [],
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "success_minor_1" | "success_minor_2" | "error">("idle");
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [delegateLink, setDelegateLink] = useState<string | null>(null);
    const [guardianSelection, setGuardianSelection] = useState<"parent" | "delegate" | null>(null);
    const [guardianName, setGuardianName] = useState("");
    const [guardianNationalId, setGuardianNationalId] = useState("");
    const [delegateNationalId, setDelegateNationalId] = useState("");
    const [todayFormatted, setTodayFormatted] = useState("");
    const isMinor = Number(participant.age) < 18;
    const minorFirstName = participant.names?.split(" ")[0] || "el menor";

    const guardianLookup = usePersonLookup(
        guardianNationalId,
        isMinor && guardianSelection === "parent",
        "No encontramos a ningún campista inscrito con esta cédula. Si tú no vas al campamento, elige «Va con otro adulto».",
    );
    const delegateLookup = usePersonLookup(
        delegateNationalId,
        isMinor && guardianSelection === "delegate",
        `No encontramos a nadie inscrito en el campamento con esta cédula. Revisa el número. Si está bien, pídele a esa persona que se comunique con el equipo de VIDA (${camp.contactEmail}) para terminar su inscripción; cuando aparezca inscrita, vuelve a este enlace para completar la de ${minorFirstName}.`,
    );

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        let imageData: ImageData | null = null;
        try {
            if (canvas.width > 0 && canvas.height > 0) {
                imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            }
        } catch {
            imageData = null;
        }

        const { width } = container.getBoundingClientRect();
        const height = Math.max(180, width * 0.4);

        canvas.width = width;
        canvas.height = height;

        if (imageData && imageData.width && imageData.height) {
            context.putImageData(imageData, 0, 0);
        }
    }, []);

    // Today's date only on the client to avoid a hydration mismatch
    useEffect(() => {
        setTodayFormatted(new Date().toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }));
    }, []);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas, submitStatus]);

    // Add touch event listeners with passive: false to prevent scroll
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const preventScroll = (e: TouchEvent) => {
            e.preventDefault();
        };

        canvas.addEventListener('touchstart', preventScroll, { passive: false });
        canvas.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', preventScroll);
            canvas.removeEventListener('touchmove', preventScroll);
        };
    }, [submitStatus]);

    const getCanvasContext = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const context = canvas.getContext("2d");
        if (!context) return null;

        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.strokeStyle = "#1f2937"; // slate-800
        return context;
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        const context = getCanvasContext();
        if (!context) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Capture pointer to avoid scroll/pan on mobile while drawing
        event.currentTarget.setPointerCapture(event.pointerId);

        context.beginPath();
        const rect = canvas.getBoundingClientRect();
        context.moveTo(event.clientX - rect.left, event.clientY - rect.top);

        const newStroke = new Path2D();
        newStroke.moveTo(event.clientX - rect.left, event.clientY - rect.top);

        setSignature((prev) => ({
            hasDrawn: true,
            strokes: [...prev.strokes, newStroke],
        }));

        setIsDrawing(true);
        setError(null);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const context = getCanvasContext();
        if (!canvas || !context) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        context.lineTo(x, y);
        context.stroke();

        setSignature((prev) => {
            if (prev.strokes.length === 0) return prev;
            const updatedStroke = prev.strokes[prev.strokes.length - 1];
            updatedStroke.lineTo(x, y);
            return prev;
        });
    };

    const handlePointerUp = () => {
        const context = getCanvasContext();
        if (!context) return;

        context.closePath();
        setIsDrawing(false);
    };

    const handlePointerLeave = () => {
        if (isDrawing) {
            handlePointerUp();
        }
    };

    const handleClearSignature = () => {
        const canvas = canvasRef.current;
        const context = getCanvasContext();
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        resizeCanvas();
        setSignature({ hasDrawn: false, strokes: [] });
        setError(null);
    };

    const handleRetry = () => {
        setSignature({ hasDrawn: false, strokes: [] });
        setError(null);
        setSubmitStatus("idle");
        setPdfUrl(null);
    };

    const minorFormError = (): string | null => {
        if (!guardianSelection) return `Elige quién acompañará a ${minorFirstName} en el campamento.`;
        if (guardianSelection === "delegate" && !guardianName.trim()) return "Escribe tu nombre completo.";
        if (!guardianNationalId.trim()) return "Escribe tu número de cédula.";
        if (guardianSelection === "parent") return lookupError(guardianLookup);
        if (!delegateNationalId.trim()) return "Escribe la cédula del adulto responsable.";
        if (delegateNationalId.trim() === guardianNationalId.trim()) return "Si tú vas al campamento, elige «Yo voy al campamento».";
        return lookupError(delegateLookup);
    };

    const getSignatureFile = async () => {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("No se encontró el lienzo de firma");
        const blob: Blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("No se pudo generar la imagen de la firma"));
            }, "image/png", 1);
        });
        return new File([blob], "signature.png", { type: "image/png" });
    };

    // The consent Edge Function signs, stores the PDF, marks the person signed, emails the boarding pass and tells staff
    const postConsent = async (fields: Record<string, string>, signatureFile: File) => {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => form.append(key, value));
        form.append("signature", signatureFile);
        const response = await fetch(consentFunctionUrl, { method: "POST", headers: consentHeaders, body: form });
        if (!response.ok) {
            const { error } = await response.json().catch(() => ({ error: null }));
            throw new Error(error || "No se pudo registrar la firma. Intenta de nuevo.");
        }
        return response;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitting) return;

        const formError = isMinor ? minorFormError() : null;
        if (formError) {
            setError(formError);
            return;
        }

        if (!signature.hasDrawn) {
            setError("Firma dentro del recuadro antes de enviar.");
            return;
        }

        if (!acceptTerms) {
            setError("Marca la casilla para aceptar los términos y condiciones.");
            return;
        }

        setError(null);
        setIsSubmitting(true);
        setSubmitStatus("idle");
        setPdfUrl(null);

        try {
            const signatureFile = await getSignatureFile();

            if (isMinor && guardianSelection === "parent" && guardianLookup.status === "found") {
                const response = await postConsent({ kind: "minor", minor_id: participant.id, manager_id: guardianLookup.person.id }, signatureFile);
                setPdfUrl(URL.createObjectURL(await response.blob()));
                setSubmitStatus("success_minor_1");
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } else if (isMinor && guardianSelection === "delegate" && delegateLookup.status === "found") {
                const response = await postConsent({
                    kind: "delegate-request",
                    minor_id: participant.id,
                    manager_id: delegateLookup.person.id,
                    tutor_name: guardianName.trim(),
                    tutor_national_id: guardianNationalId.trim(),
                }, signatureFile);
                const { delegateNotified, link } = await response.json();
                // the email to the manager failed: the parent shares the link instead
                setDelegateLink(delegateNotified ? null : link);
                setSubmitStatus("success_minor_2");
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } else if (!isMinor) {
                const response = await postConsent({ kind: "adult", person_id: participant.id }, signatureFile);
                const url = URL.createObjectURL(await response.blob());
                setPdfUrl(url);
                setSubmitStatus("success");
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Store PDF URL in sessionStorage for the success page
                sessionStorage.setItem('pdfUrl', url);
                sessionStorage.setItem('participantId', participant.national_id);

                setTimeout(() => {
                    router.push("/success");
                }, 2000);
            }
        } catch (err: unknown) {
            console.error(err);
            setSubmitStatus("error");
            setError(err instanceof Error ? err.message : "Ocurrió un error al enviar la firma.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const guardianOptions = [
        {
            value: "parent" as const,
            title: "Yo voy al campamento",
            description: `Estoy inscrito(a) como campista y seré el responsable de ${minorFirstName}.`,
        },
        {
            value: "delegate" as const,
            title: "Va con otro adulto",
            description: `${minorFirstName} irá con otro adulto que ya está inscrito en el campamento y que será su representante allá.`,
        },
    ];

    return (
        <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8 relative">
            {isSubmitting && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center z-50">
                    <div className="relative">
                        <div className="h-16 w-16 border-4 border-ink/15 rounded-full"></div>
                        <div className="absolute top-0 left-0 h-16 w-16 border-4 border-vermilion border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-ink">Generando tu documento...</h3>
                    <p className="mt-2 text-ink/70">Estamos creando tu PDF y registrando tu firma.</p>
                </div>
            )}
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 text-center">
                    <Wordmark className="text-vermilion text-2xl sm:text-3xl mb-8" />
                    <h1 className="font-display text-lg sm:text-2xl text-oxblood leading-snug">
                        {consentTitle}
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-ink/70">
                        {isMinor
                            ? `${minorFirstName} es menor de edad. Su padre, madre o tutor(a) debe completar estos pasos y firmar al final.`
                            : "Lee el documento y fírmalo al final para confirmar tu participación."}
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-ink/15 overflow-hidden">
                    <header className="px-5 py-5 sm:px-8 bg-parchment/40">
                        <p className="text-sm font-semibold text-ink/60">{isMinor ? "Campista menor de edad" : "Participante"}</p>
                        <p className="mt-0.5 text-xl font-bold text-ink">{fullName(participant)}</p>
                        <p className="mt-0.5 text-sm text-ink/70">{isMinor ? "T.I." : "C.C."} {participant.national_id}</p>
                    </header>

                    {!isSubmitting && submitStatus === "success_minor_1" && pdfUrl && (
                        <div className="border-t border-ink/10 px-5 py-10 sm:px-8 text-center">
                            {successIcon}
                            <h2 className="mt-6 text-2xl font-bold text-glass">Autorización firmada</h2>
                            <p className="mt-2 text-ink/80">El consentimiento de {minorFirstName} quedó registrado. Guarda una copia del PDF:</p>
                            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex justify-center rounded-xl bg-oxblood px-6 py-3 text-sm font-bold text-white hover:bg-oxblood/90">
                                    Ver PDF
                                </a>
                                <a href={pdfUrl} download="consentimiento.pdf" className="inline-flex justify-center rounded-xl border border-ink/20 bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-ink/5">
                                    Descargar PDF
                                </a>
                            </div>
                        </div>
                    )}

                    {!isSubmitting && submitStatus === "success_minor_2" && (
                        <div className="border-t border-ink/10 px-5 py-10 sm:px-8 text-center">
                            {successIcon}
                            <h2 className="mt-6 text-2xl font-bold text-glass">Autorización firmada</h2>
                            {delegateLink ? (
                                <>
                                    <p className="mt-2 text-ink/80">
                                        No pudimos enviarle el correo a {delegateLookup.status === "found" ? fullName(delegateLookup.person) : "el responsable"}.
                                        Compártele este enlace para que firme; cuando lo haga, {minorFirstName} recibirá su QR de acceso.
                                    </p>
                                    <p className="mt-4 break-all rounded-xl bg-parchment/60 px-4 py-3 text-left text-sm font-semibold text-ink">{delegateLink}</p>
                                </>
                            ) : (
                                <p className="mt-2 text-ink/80">
                                    Enviamos un correo a {delegateLookup.status === "found" ? fullName(delegateLookup.person) : "el responsable"} para
                                    que también firme. Cuando lo haga, {minorFirstName} recibirá su QR de acceso.
                                </p>
                            )}
                        </div>
                    )}

                    {!isSubmitting && submitStatus === "success" && (
                        <div className="border-t border-ink/10 px-5 py-10 sm:px-8 text-center">
                            {successIcon}
                            <h2 className="mt-6 text-2xl font-bold text-glass">Consentimiento firmado</h2>
                            <p className="mt-2 text-ink/80">Tu consentimiento quedó registrado.</p>
                            <p className="mt-2 text-sm text-glass">Redirigiendo en unos momentos...</p>
                        </div>
                    )}

                    {!isSubmitting && submitStatus === "error" && (
                        <div className="border-t border-ink/10 px-5 py-10 sm:px-8 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vermilion">
                                <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="mt-6 text-2xl font-bold text-oxblood">No se pudo enviar la firma</h2>
                            {error && <p className="mt-2 text-oxblood/80">{error}</p>}
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="mt-6 rounded-xl bg-oxblood px-6 py-3 text-sm font-bold text-white hover:bg-oxblood/90"
                            >
                                Intentar nuevamente
                            </button>
                        </div>
                    )}

                    {submitStatus === "idle" && (
                        <form onSubmit={handleSubmit} noValidate>
                            {isMinor && (
                                <>
                                    <Step n={1} title={`¿Quién acompañará a ${minorFirstName} en el campamento?`}>
                                        <fieldset>
                                            <legend className="sr-only">Responsable del menor durante el campamento</legend>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {guardianOptions.map((option) => {
                                                    const selected = guardianSelection === option.value;
                                                    return (
                                                        <label
                                                            key={option.value}
                                                            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${selected ? "border-oxblood bg-oxblood/5 ring-1 ring-oxblood" : "border-ink/20 bg-white hover:border-ink/40"}`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="guardian-option"
                                                                value={option.value}
                                                                checked={selected}
                                                                onChange={() => { setGuardianSelection(option.value); setError(null); }}
                                                                className="mt-1 h-4 w-4 flex-none accent-oxblood"
                                                            />
                                                            <span>
                                                                <span className="block font-semibold text-ink">{option.title}</span>
                                                                <span className="mt-1 block text-sm text-ink/70">{option.description}</span>
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </fieldset>
                                    </Step>

                                    <Step
                                        n={2}
                                        title="Tus datos"
                                        hint={guardianSelection === "parent"
                                            ? "Con tu cédula buscamos tu inscripción en el campamento."
                                            : "Como padre, madre o tutor(a) del menor."}
                                    >
                                        {!guardianSelection ? (
                                            <p className="text-sm text-ink/60">Primero elige una opción en el paso 1.</p>
                                        ) : (
                                            <div className="space-y-5">
                                                <div className="grid gap-5 sm:grid-cols-2">
                                                    {guardianSelection === "delegate" && (
                                                        <div>
                                                            <label htmlFor="guardian-name" className={labelClass}>Tu nombre completo</label>
                                                            <input
                                                                id="guardian-name"
                                                                type="text"
                                                                autoComplete="name"
                                                                value={guardianName}
                                                                onChange={(e) => setGuardianName(e.target.value)}
                                                                className={inputClass}
                                                            />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label htmlFor="guardian-id" className={labelClass}>Tu número de cédula (C.C.)</label>
                                                        <input
                                                            id="guardian-id"
                                                            type="text"
                                                            inputMode="numeric"
                                                            autoComplete="off"
                                                            value={guardianNationalId}
                                                            onChange={(e) => setGuardianNationalId(e.target.value.replace(/\s/g, ""))}
                                                            aria-describedby={guardianSelection === "parent" ? "guardian-lookup" : undefined}
                                                            className={inputClass}
                                                        />
                                                        {guardianSelection === "parent" && <LookupNote lookup={guardianLookup} id="guardian-lookup" />}
                                                    </div>
                                                </div>

                                                {guardianSelection === "delegate" && (
                                                    <div className="rounded-xl bg-parchment/50 p-4">
                                                        <label htmlFor="delegate-id" className={labelClass}>Cédula del adulto que acompañará a {minorFirstName}</label>
                                                        <ul id="delegate-hint" className="mb-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/70">
                                                            <li>Es la persona adulta con la que {minorFirstName} irá al campamento y que será su representante allá (por ejemplo, un familiar o un líder).</li>
                                                            <li>Esa persona <strong className="text-ink">ya debe estar inscrita</strong> en el campamento. Escribe su número de cédula sin puntos ni espacios.</li>
                                                            <li>Le enviaremos un correo para que también firme esta autorización.</li>
                                                        </ul>
                                                        <input
                                                            id="delegate-id"
                                                            type="text"
                                                            inputMode="numeric"
                                                            autoComplete="off"
                                                            value={delegateNationalId}
                                                            onChange={(e) => setDelegateNationalId(e.target.value.replace(/\s/g, ""))}
                                                            aria-describedby="delegate-hint delegate-lookup"
                                                            className={`${inputClass} sm:max-w-xs`}
                                                        />
                                                        <LookupNote lookup={delegateLookup} id="delegate-lookup" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Step>
                                </>
                            )}

                            <Step
                                n={isMinor ? 3 : 1}
                                title="Lee el documento"
                                hint={isMinor ? "Lo que escribiste arriba aparece en negrita." : undefined}
                            >
                                {isMinor ? (
                                    <MinorConsent
                                        minor={participant}
                                        tutorName={guardianSelection === "parent"
                                            ? (guardianLookup.status === "found" ? fullName(guardianLookup.person) : undefined)
                                            : guardianName.trim()}
                                        tutorNationalId={guardianNationalId.trim()}
                                        option={guardianSelection}
                                        delegateName={delegateLookup.status === "found" ? fullName(delegateLookup.person) : undefined}
                                        delegateNationalId={delegateLookup.status === "found" ? delegateNationalId.trim() : undefined}
                                    />
                                ) : (
                                    <AdultConsent person={participant} date={todayFormatted} />
                                )}
                            </Step>

                            <Step
                                n={isMinor ? 4 : 2}
                                title={isMinor ? "Firma del padre, madre o tutor(a)" : "Tu firma"}
                                hint="Firma dentro del recuadro con el dedo o con el mouse."
                            >
                                <div ref={containerRef} className="rounded-2xl border-2 border-dashed border-ink/15 bg-parchment/40 p-3">
                                    <canvas
                                        ref={canvasRef}
                                        aria-label="Recuadro de firma"
                                        className="w-full rounded-xl bg-white shadow-inner touch-none"
                                        style={{ touchAction: "none" }}
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerLeave={handlePointerLeave}
                                        onPointerCancel={handlePointerUp}
                                        onContextMenu={(e) => e.preventDefault()}
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleClearSignature}
                                            className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
                                        >
                                            Borrar firma
                                        </button>
                                    </div>
                                </div>

                                <label className="mt-6 flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={acceptTerms}
                                        onChange={(event) => setAcceptTerms(event.target.checked)}
                                        className="mt-0.5 h-5 w-5 flex-none accent-oxblood"
                                    />
                                    <span className="text-sm leading-relaxed text-ink/80">
                                        Declaro que he leído y acepto los términos y condiciones establecidos para la participación en
                                        el campamento, incluyendo las políticas de seguridad, convivencia y uso de imagen.
                                    </span>
                                </label>

                                {error && (
                                    <p role="alert" className="mt-6 rounded-xl border border-vermilion/40 bg-vermilion/5 px-4 py-3 text-sm font-semibold text-oxblood">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-oxblood px-6 text-base font-bold text-white transition-colors hover:bg-oxblood/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                    Firmar y enviar
                                </button>
                                <p className="mt-3 text-sm text-ink/60">
                                    {isMinor && guardianSelection === "delegate"
                                        ? "El responsable recibirá un correo para firmar también."
                                        : "Recibirás tu código QR de acceso en tu correo electrónico."}
                                </p>
                            </Step>
                        </form>
                    )}
                </div>

                <div className="mt-10 flex justify-center">
                    <img
                        src="/logos/vida_logo_black.PNG"
                        alt="Ministerio Juvenil VIDA"
                        className="h-16 w-auto object-contain"
                        loading="lazy"
                    />
                </div>

                <footer className="mt-8 text-center text-sm text-ink/60">
                    <p>
                        ¿Preguntas o problemas para firmar? Escríbenos a{" "}
                        <a href={`mailto:${camp.contactEmail}`} className="font-semibold text-oxblood underline underline-offset-2">{camp.contactEmail}</a>.
                    </p>
                </footer>
            </div>
        </div>
    );
}
