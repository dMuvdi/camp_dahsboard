"use client";

import { useEffect, useState } from "react";
import Wordmark from "@/components/Wordmark";
import { camp } from "@/lib/camp";

export default function SuccessPage() {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [participantId, setParticipantId] = useState<string | null>(null);

    useEffect(() => {
        // Retrieve PDF URL from sessionStorage
        const storedPdfUrl = sessionStorage.getItem('pdfUrl');
        const storedParticipantId = sessionStorage.getItem('participantId');

        if (storedPdfUrl) {
            setPdfUrl(storedPdfUrl);
        }
        if (storedParticipantId) {
            setParticipantId(storedParticipantId);
        }
    }, []);
    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-xl w-full mx-auto text-center">
                {/* Brand art: the dove window from the Canva guide; multiply drops its white background */}
                <img
                    src="/brand/window-dove.png"
                    alt=""
                    className="mx-auto h-40 w-auto mix-blend-multiply"
                />

                <div className="mt-8 bg-white rounded-2xl border border-ink/10 p-8 md:p-10 text-left">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-glass" aria-hidden="true">
                            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </span>
                        <h1 className="font-display text-2xl md:text-3xl text-oxblood">Registro completado</h1>
                    </div>

                    <p className="mt-4 text-lg text-ink/80 leading-relaxed">
                        Tu consentimiento quedó registrado para Revelation Camp.
                    </p>

                    <dl className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
                        <div className="py-5">
                            <dt className="font-semibold text-ink">Revisa tu correo electrónico</dt>
                            <dd className="mt-1 text-ink/75 leading-relaxed">
                                Te enviamos un correo con tu código QR de confirmación. Ese código es tu pase de entrada al campamento.
                            </dd>
                        </div>
                        <div className="py-5">
                            <dt className="font-semibold text-ink">Día del evento</dt>
                            <dd className="mt-1 text-ink/75 leading-relaxed">
                                Ten tu código QR listo en el teléfono o impreso. Lo necesitarás para el check-in.
                            </dd>
                        </div>
                        {pdfUrl && (
                            <div className="py-5">
                                <dt className="font-semibold text-ink">Tu documento firmado</dt>
                                <dd className="mt-1 text-ink/75 leading-relaxed">
                                    Descarga una copia de tu consentimiento para tus registros.
                                </dd>
                                <dd className="mt-3">
                                    <a
                                        href={pdfUrl}
                                        download={`consentimiento_${participantId || 'documento'}.pdf`}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-oxblood text-parchment hover:bg-oxblood/90 transition-colors"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 7h16" />
                                        </svg>
                                        Descargar PDF
                                    </a>
                                </dd>
                            </div>
                        )}
                    </dl>

                    <p className="mt-6 text-sm text-ink/60">
                        Si tienes preguntas o no recibiste el correo, escríbenos a{' '}
                        <a href={`mailto:${camp.contactEmail}`} className="font-semibold text-oxblood underline underline-offset-2 hover:text-vermilion">
                            {camp.contactEmail}
                        </a>
                    </p>
                </div>

                <div className="mt-10 flex items-center justify-center gap-8">
                    <Wordmark className="text-vermilion text-xl" />
                    <img
                        src="/logos/vida_logo_black.PNG"
                        alt="Ministerio Juvenil VIDA"
                        className="h-12 w-auto object-contain"
                        loading="lazy"
                    />
                </div>
            </div>
        </div>
    );
}
