"use client";

import { useEffect, useState } from "react";

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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center px-4 py-12">
            <div className="max-w-2xl mx-auto text-center">
                {/* Success Icon */}
                <div className="mx-auto mb-8 h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-2xl animate-pulse">
                    <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 md:p-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                        ¡Registro Completado!
                    </h1>

                    <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                        Tu consentimiento ha sido registrado exitosamente para el <span className="font-bold text-slate-800">Relevante Camp 2025</span>.
                    </p>

                    {/* Email Instructions */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-200">
                        <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                                <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-bold text-blue-900 mb-2">Revisa tu correo electrónico</h3>
                                <p className="text-blue-800 leading-relaxed">
                                    Te hemos enviado un correo con tu <strong>código QR de confirmación</strong>.
                                    Este código es tu pase de entrada al campamento.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* QR Code Instructions */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 mb-8 border border-amber-200">
                        <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                                <div className="h-12 w-12 rounded-xl bg-amber-500 flex items-center justify-center">
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-bold text-amber-900 mb-2">Día del evento</h3>
                                <p className="text-amber-800 leading-relaxed">
                                    <strong>¡Importante!</strong> Ten tu código QR listo en tu teléfono o impreso.
                                    Lo necesitarás para el check-in el día del campamento.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* PDF Download */}
                    {pdfUrl && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-200">
                            <div className="flex items-center justify-center space-x-4">
                                <div className="flex-shrink-0">
                                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-left flex-1">
                                    <h3 className="text-lg font-bold text-green-900 mb-2">Tu documento firmado</h3>
                                    <p className="text-green-800 text-sm mb-3">
                                        Descarga una copia de tu consentimiento firmado para tus registros.
                                    </p>
                                    <a
                                        href={pdfUrl}
                                        download={`consentimiento_${participantId || 'documento'}.pdf`}
                                        className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                                        style={{ backgroundColor: "#9bc3db" }}
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 7h16" />
                                        </svg>
                                        <span>Descargar PDF</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logos */}
                    <div className="flex items-center justify-center gap-8 mb-8">
                        <img
                            src="/logos/relevante_logo_brown.PNG"
                            alt="Relevante Camp"
                            className="h-12 w-auto object-contain"
                            loading="lazy"
                        />
                        <img
                            src="/logos/vida_logo_black.PNG"
                            alt="Ministerio Juvenil VIDA"
                            className="h-16 w-auto object-contain"
                            loading="lazy"
                        />
                    </div>

                    {/* Contact Info */}
                    <div className="text-center">
                        <p className="text-sm text-slate-500 mb-4">
                            Si tienes preguntas o no recibiste el correo, contáctanos:
                        </p>
                        <a
                            href="mailto:lizpaolamorillo1@gmail.com"
                            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>lizpaolamorillo1@gmail.com</span>
                        </a>
                    </div>
                </div>

                {/* Footer Message */}
                <div className="mt-8 text-center">
                    <p className="text-lg font-semibold text-slate-700">
                        ¡Nos vemos en el Relevante Camp 2025! 🏕️
                    </p>
                </div>
            </div>
        </div>
    );
}
