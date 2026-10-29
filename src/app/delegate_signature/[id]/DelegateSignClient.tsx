"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/supabase";
import Wordmark from "@/components/Wordmark";
import { MinorConsent, consentTitle, fullName } from "@/components/ConsentDocument";
import { camp } from "@/lib/camp";
import { consentFunctionUrl, consentHeaders } from "@/lib/consentApi";

interface DelegateSignClientProps {
    minor: User;
    manager: User | null;
}

interface SignatureState {
    hasDrawn: boolean;
    strokes: Path2D[];
}

export default function DelegateSignClient({
    minor,
    manager,
}: DelegateSignClientProps) {
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
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    // The manager is loaded on the server with the minor
    const delegateNationalId = manager?.national_id ?? "";
    const delegateFullName = manager ? fullName(manager) : "";
    const isLoadingManager = false;
    const [todayFormatted, setTodayFormatted] = useState("");
    const [isMounted, setIsMounted] = useState(false);

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
        } catch (err) {
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

    // Set mounted state and today's date on client side to avoid hydration mismatch
    useEffect(() => {
        setIsMounted(true);
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
    }, [resizeCanvas]);

    // Add touch event listeners with passive: false to prevent scroll
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

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
        handleClearSignature();
        setSubmitStatus("idle");
        setPdfUrl(null);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitting) return;

        if (!signature.hasDrawn) {
            setError("Por favor firme el documento antes de continuar.");
            return;
        }

        if (!acceptTerms) {
            setError("Debes aceptar los términos y condiciones para continuar.");
            return;
        }

        if (isLoadingManager || !delegateNationalId || !delegateFullName) {
            setError("Por favor espera mientras se carga la información del responsable.");
            return;
        }

        setError(null);
        setIsSubmitting(true);
        setSubmitStatus("idle");
        setPdfUrl(null);

        try {
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("No se encontró el lienzo de firma");

            const signatureBlob: Blob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("No se pudo generar la imagen de la firma"));
                }, "image/png", 1);
            });

            // The consent Edge Function builds the PDF with the parent's and this signature, marks the minor signed and emails the QR
            const form = new FormData();
            form.append("kind", "delegate");
            form.append("minor_id", minor.id);
            form.append("signature", new File([signatureBlob], "signature.png", { type: "image/png" }));
            const response = await fetch(consentFunctionUrl, { method: "POST", headers: consentHeaders, body: form });
            if (!response.ok) {
                const { error } = await response.json().catch(() => ({ error: null }));
                throw new Error(error || "No se pudo registrar la firma. Intenta de nuevo.");
            }
            setPdfUrl(URL.createObjectURL(await response.blob()));

            setSubmitStatus("success");

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err: unknown) {
            console.error(err);
            handleClearSignature();
            setSubmitStatus("error");
            setError(err instanceof Error ? err.message : "Ocurrió un error al enviar la firma.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 relative">
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
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <Wordmark className="text-vermilion text-2xl sm:text-3xl mb-8" />
                    <h1 className="font-display text-xl sm:text-2xl text-oxblood leading-snug">
                        {consentTitle}
                    </h1>
                    <p className="mt-4 text-lg text-ink/70">
                        {minor.tutor_name || "El padre, madre o tutor(a)"} te autorizó como responsable de {minor.names} durante el
                        campamento. Lee el documento y firma al final para aceptarlo.
                    </p>
                </div>

                <section className="bg-white rounded-2xl border border-ink/15 overflow-hidden">
                    <header className="px-5 sm:px-8 py-6 border-b border-ink/10 bg-parchment/40">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                                <p className="text-sm text-ink/60 font-semibold">Participante</p>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-ink">
                                        {minor.names} {minor.last_name_1} {minor.last_name_2}
                                    </h2>
                                    {isMounted && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-vermilion/10 text-oxblood border border-vermilion/30">
                                            Menor de edad
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-ink/70 mt-1">T.I. {minor.national_id}</p>
                            </div>
                        </div>
                    </header>

                    <article className="px-5 sm:px-8 py-8 space-y-8">

                        {!isSubmitting && submitStatus === "success" && (
                            <div className="rounded-2xl border-2 border-glass/30 bg-glass/5 p-8 text-center">
                                <div className="mx-auto h-14 w-14 rounded-full bg-glass flex items-center justify-center">
                                    <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="mt-6 text-2xl font-extrabold text-glass">¡Firma enviada con éxito!</h3>
                                <p className="mt-2 text-ink/80">El consentimiento del menor a tu cargo ha sido registrado correctamente.</p>
                            </div>
                        )}

                        {!isSubmitting && submitStatus === "error" && (
                            <div className="rounded-2xl border-2 border-vermilion/40 bg-vermilion/5 p-8 text-center">
                                <div className="mx-auto h-14 w-14 rounded-full bg-vermilion flex items-center justify-center">
                                    <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h3 className="mt-6 text-2xl font-extrabold text-oxblood">No se pudo enviar la firma</h3>
                                {error && <p className="mt-2 text-oxblood/80">{error}</p>}
                                <div className="mt-6">
                                    <button
                                        type="button"
                                        onClick={handleRetry}
                                        className="px-6 py-3 rounded-2xl text-sm font-bold text-white bg-oxblood hover:bg-oxblood/90"
                                    >
                                        Intentar nuevamente
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-6">
                            <MinorConsent
                                minor={minor}
                                tutorName={minor.tutor_name}
                                tutorNationalId={minor.tutor_national_id}
                                option="delegate"
                                delegateName={isLoadingManager ? undefined : delegateFullName}
                                delegateNationalId={isLoadingManager ? undefined : delegateNationalId}
                            />
                            {isLoadingManager && (
                                <p className="text-xs text-ink/60">Cargando información del responsable...</p>
                            )}

                            {submitStatus === "idle" && !isSubmitting && (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-ink pb-2">Firma electrónica</h3>
                                        <p className="text-sm text-ink/60 mb-4">
                                            Por favor firma dentro del recuadro utilizando tu dedo (en dispositivos táctiles) o el cursor (en
                                            computadoras).
                                        </p>
                                        <div ref={containerRef} className="bg-parchment/40 border-2 border-dashed border-ink/15 rounded-2xl p-4">
                                            <canvas
                                                ref={canvasRef}
                                                className="w-full rounded-2xl bg-white shadow-inner touch-none"
                                                style={{ touchAction: "none" }}
                                                onPointerDown={handlePointerDown}
                                                onPointerMove={handlePointerMove}
                                                onPointerUp={handlePointerUp}
                                                onPointerLeave={handlePointerLeave}
                                                onPointerCancel={handlePointerUp}
                                                onContextMenu={(e) => e.preventDefault()}
                                            />
                                            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <p className="text-xs text-ink/60">
                                                    Al firmar confirmas tu identidad y aceptación de los términos presentados.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleClearSignature}
                                                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-ink/70 bg-white border border-ink/15 hover:bg-ink/5 transition"
                                                >
                                                    Limpiar firma
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 col grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-ink/80">
                                            <div>
                                                <span className="font-semibold">Nombre:</span>
                                                <span className="ml-2">{fullName(minor)}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">T.I.:</span>
                                                <span className="ml-2">{minor.national_id}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">Email:</span>
                                                <span className="ml-2">{minor.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={acceptTerms}
                                                onChange={(event) => setAcceptTerms(event.target.checked)}
                                                className="mt-1 h-5 w-5 rounded border border-ink/25 text-oxblood focus:ring-vermilion"
                                            />
                                            <span className="text-sm text-ink/80 leading-relaxed">
                                                Declaro que he leído y acepto los términos y condiciones establecidos para la participación en
                                                el campamento, incluyendo las políticas de seguridad, convivencia y uso de imagen.
                                            </span>
                                        </label>
                                    </div>

                                    {error && (
                                        <div className="rounded-2xl border-2 border-vermilion/40 bg-vermilion/5 px-4 py-3 text-sm text-oxblood font-semibold">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="text-sm text-ink/60">
                                            <p>Al enviar este formulario se registrará la firma electrónica y se actualizará tu estado.</p>
                                            <p className="mt-1">Recibirás una copia del acuerdo en tu correo electrónico.</p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting || isLoadingManager || !delegateNationalId || !delegateFullName}
                                            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-base font-bold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed bg-oxblood hover:bg-oxblood/90"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>Enviar firma</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </article>
                </section>

                <div className="mt-10 flex flex-col items-center gap-6">
                    {/* Logos centered */}
                    <div className="flex items-center justify-center gap-8">
                        <img
                            src="/logos/vida_logo_black.PNG"
                            alt="Ministerio Juvenil VIDA"
                            className="h-16 w-auto object-contain"
                            loading="lazy"
                        />
                    </div>
                </div>

                <footer className="mt-8 text-center text-sm text-ink/60">
                    <p>Si tienes preguntas o necesitas asistencia, contacta a nuestro equipo en {camp.contactEmail}.</p>
                </footer>
            </div>
        </div>
    );
}

