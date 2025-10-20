"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/supabase";

interface ContractSignClientProps {
    participant: User;
}

interface SignatureState {
    hasDrawn: boolean;
    strokes: Path2D[];
}

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
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const todayFormatted = new Date().toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

            const context = canvas.getContext("2d");
            if (!context) return;

            const { width } = container.getBoundingClientRect();
            const height = Math.max(180, width * 0.4);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            canvas.width = width;
            canvas.height = height;

            context.putImageData(imageData, 0, 0);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
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
        setSignature({ hasDrawn: false, strokes: [] });
        setError(null);
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

        setError(null);
        setIsSubmitting(true);
        setSubmitStatus("idle");
        setPdfUrl(null);

        try {
            // Convert canvas to PNG blob
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("No se encontró el lienzo de firma");

            const signatureBlob: Blob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("No se pudo generar la imagen de la firma"));
                }, "image/png", 1);
            });

            // Build FormData for Edge Function
            const formData = new FormData();
            formData.append("person_id", participant.id);
            formData.append(
                "signature",
                new File([signatureBlob], "signature.png", { type: "image/png" })
            );

            // Use Supabase anon key for Edge Function authentication
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            // Call Supabase Edge Function to create PDF
            const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-consent-pdf`;
            const response = await fetch(functionsUrl, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${anonKey}`,
                    'apikey': anonKey || '',
                },
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "No se pudo generar el PDF");
            }

            const pdfBlob = await response.blob();
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);

            // Update has_signed flag via RPC
            const { error: updateError } = await supabase.rpc('update_person', {
                p_age: participant.age,
                p_checked_in: participant.checked_in,
                p_checked_out: participant.checked_out,
                p_email: participant.email,
                p_emergency_contact: participant.emergency_contact,
                p_emergency_contact_phone_number: participant.emergency_contact_phone_number,
                p_has_signed: true,
                p_id: participant.id,
                p_last_name_1: participant.last_name_1,
                p_last_name_2: participant.last_name_2,
                p_names: participant.names,
                p_national_id: participant.national_id,
                p_phone_number: participant.phone_number
            });

            if (updateError) {
                // Not fatal for user experience, but log for debugging
                console.error('Failed to update has_signed:', updateError);
            }

            setSubmitStatus("success");

            // Store PDF URL in sessionStorage for the success page
            if (url) {
                sessionStorage.setItem('pdfUrl', url);
                sessionStorage.setItem('participantId', participant.national_id);
            }

            // Redirect to success page after a short delay
            setTimeout(() => {
                router.push("/success");
            }, 2000);
        } catch (err: unknown) {
            console.error(err);
            setSubmitStatus("error");
            setError(err instanceof Error ? err.message : "Ocurrió un error al enviar la firma.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Declaration content provided by the user
    const declarationTitle = "CONSENTIMIENTO VOLUNTARIO E INFORMADO DE PARTICIPACIÓN RELEVANTE CAMP 2025";

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative">
            {isSubmitting && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center z-50">
                    <div className="relative">
                        <div className="h-16 w-16 border-4 border-slate-200 rounded-full"></div>
                        <div className="absolute top-0 left-0 h-16 w-16 border-4 border-[#9bc3db] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-slate-900">Generando tu documento...</h3>
                    <p className="mt-2 text-slate-600">Estamos creando tu PDF y registrando tu firma.</p>
                </div>
            )}
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        {declarationTitle}
                    </h1>
                    <p className="mt-4 text-lg text-slate-600">
                        Por favor lee cuidadosamente el documento y firma al final para confirmar tu participación.
                    </p>
                </div>

                <section className="bg-white shadow-2xl rounded-3xl border border-slate-200 overflow-hidden">
                    <header className="px-8 py-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                                <p className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Participante</p>
                                <h2 className="text-2xl font-bold text-slate-900">
                                    {participant.names} {participant.last_name_1} {participant.last_name_2}
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">C.C. {participant.national_id}</p>
                            </div>
                        </div>
                    </header>

                    <article className="px-8 py-8 space-y-8">

                        {!isSubmitting && submitStatus === "success" && (
                            <div className="rounded-3xl border-2 border-green-200 bg-green-50 p-8 text-center shadow-xl">
                                <div className="mx-auto h-14 w-14 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="mt-6 text-2xl font-extrabold text-green-800">¡Firma enviada con éxito!</h3>
                                <p className="mt-2 text-green-800/80">Tu consentimiento ha sido registrado correctamente.</p>
                                <p className="mt-2 text-green-700 text-sm">Redirigiendo en unos momentos...</p>
                            </div>
                        )}

                        {!isSubmitting && submitStatus === "error" && (
                            <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-8 text-center shadow-xl">
                                <div className="mx-auto h-14 w-14 rounded-full bg-red-500 flex items-center justify-center">
                                    <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h3 className="mt-6 text-2xl font-extrabold text-red-800">No se pudo enviar la firma</h3>
                                {error && <p className="mt-2 text-red-800/80">{error}</p>}
                                <div className="mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setSubmitStatus("idle")}
                                        className="px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-xl"
                                        style={{ backgroundColor: "#9bc3db" }}
                                    >
                                        Intentar nuevamente
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-6">
                            <div>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    RELEVANTE CAMP es una actividad promovida del Ministerio de Jóvenes VIDA de la Iglesia Centro Bíblico
                                    Internacional de Cartagena en el ejercicio del derecho fundamental a la libertad religiosa y de cultos
                                    consagrada en el artículo 19 de la Constitución Política de Colombia. En ese sentido, la actividad busca
                                    unir a los campistas en prácticas colectivas de actos de oración, culto, enseñanza y festividades de
                                    conformidad a las creencias religiosas que profesamos.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Yo {participant.names} {participant.last_name_1} {participant.last_name_2} identificado con C.C. No. {participant.national_id}, manifiesto mi
                                    participación voluntaria y bajo mi propia responsabilidad en el RELEVANTE CAMP, de ahora en adelante Campamento.
                                    Así mismo, declaro que conozco el listado de actividades que se programarán para los campistas, por lo que acepto
                                    participar en todas las actividades que se dispongan, salvo las que se expresen en las observaciones y anotaciones.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Yo acepto y entiendo que el personal que dirigirá el Campamento se esfuerza por proporcionar un ambiente seguro y
                                    supervisado, pero reconozco y acepto que existen ciertos riesgos inherentes en las actividades al aire libre y
                                    podría estar expuestos a situaciones imprevistas. Entiendo que el Campamento hará todo lo posible para garantizar
                                    la seguridad de los participantes, así que eximo de responsabilidad a la Iglesia Centro Bíblico Internacional y a
                                    los organizadores del Campamento por lesiones, pérdidas, daños materiales o personales que puedan ocurrir durante
                                    el campamento, siempre que no medie dolo o culpa grave de su parte.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Autorizo a los organizadores del campamento para utilizar fotografías, videos u otros medios de grabación que
                                    incluyan mi imagen para propósito promocionales o educativos, siempre y cuando no se violente mi integridad y que
                                    se respete mi privacidad y seguridad en todas las publicaciones. Entiendo que las actividades del Campamento se
                                    realizarán en el predio privado LA NICLALA en la Isla Bocachica, por lo que las instalaciones como habitaciones,
                                    zonas de descanso, piscinas, así como las comidas son proporcionados por la Finca La Niclala, y no por la Iglesia
                                    Centro Bíblico Internacional de Cartagena, por lo que declaro que libero de total responsabilidad al Campamento y a
                                    la Iglesia de los servicios prestados por la Finca La Niclala. También acepto que conozco que empresas privadas
                                    prestarán el servicio de transporte marítimo desde la ciudad de Cartagena a la Isla Bocachica.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    En ese sentido, autorizo de manera voluntaria y libre mi participación en el Campamento RELEVANTE CAMP,
                                    comprometiéndome a dar cumplimiento a las indicaciones generales del campamento que se anexan a este documento,
                                    por lo que acataré las restricciones que se fijen como necesarias de seguridad y salubridad, así como cumplir con
                                    las acciones de autocuidado.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Por otra parte, siendo que de manera voluntaria expreso mi deseo de autorizar viaje y campamento, me comprometo a
                                    no presentar ninguna denuncia, queja y/o algún tipo de acción frente a la Iglesia Centro Bíblico Internacional de
                                    la ciudad de Cartagena. De la misma manera me comprometo llevar equipo de protección personal necesario y requerido
                                    por el Campamento, así mismo, me comprometo a cumplir todas las normas de bioseguridad establecidas para protegerme,
                                    proteger a los demás, de manera íntegra y velando por la salud de todos los participantes del viaje y campamento
                                    conforme a lo dispuesto por los organizadores del evento.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Para los efectos legales pertinentes, suscribo el presente documento de forma voluntaria hoy {todayFormatted}.
                                </p>
                            </div>

                            {submitStatus === "idle" && !isSubmitting && (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 pb-2">Firma electrónica</h3>
                                        <p className="text-sm text-slate-500 mb-4">
                                            Por favor firma dentro del recuadro utilizando tu dedo (en dispositivos táctiles) o el cursor (en
                                            computadoras).
                                        </p>
                                        <div ref={containerRef} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-4">
                                            <canvas
                                                ref={canvasRef}
                                                className="w-full rounded-2xl bg-white shadow-inner touch-none"
                                                style={{ touchAction: "none" }}
                                                onPointerDown={handlePointerDown}
                                                onPointerMove={handlePointerMove}
                                                onPointerUp={handlePointerUp}
                                                onPointerLeave={handlePointerLeave}
                                                onPointerCancel={handlePointerUp}
                                                onTouchStart={(e) => e.preventDefault()}
                                                onTouchMove={(e) => e.preventDefault()}
                                                onContextMenu={(e) => e.preventDefault()}
                                            />
                                            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <p className="text-xs text-slate-500">
                                                    Al firmar confirmas tu identidad y aceptación de los términos presentados.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleClearSignature}
                                                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition"
                                                >
                                                    Limpiar firma
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700">
                                            <div>
                                                <span className="font-semibold">Nombre:</span>
                                                <span className="ml-2">{participant.names} {participant.last_name_1} {participant.last_name_2}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">C.C.:</span>
                                                <span className="ml-2">{participant.national_id}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">Email:</span>
                                                <span className="ml-2">{participant.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={acceptTerms}
                                                onChange={(event) => setAcceptTerms(event.target.checked)}
                                                className="mt-1 h-5 w-5 rounded border border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700 leading-relaxed">
                                                Declaro que he leído y acepto los términos y condiciones establecidos para la participación en
                                                el campamento, incluyendo las políticas de seguridad, convivencia y uso de imagen.
                                            </span>
                                        </label>
                                    </div>

                                    {error && (
                                        <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="text-sm text-slate-500">
                                            <p>Al enviar este formulario se registrará la firma electrónica y se actualizará tu estado.</p>
                                            <p className="mt-1">Recibirás una copia del acuerdo en tu correo electrónico.</p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-base font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: "#9bc3db" }}
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
                </div>

                <footer className="mt-8 text-center text-sm text-slate-500">
                    <p>Si tienes preguntas o necesitas asistencia, contacta a nuestro equipo en lizpaolamorillo1@gmail.com.</p>
                </footer>
            </div>
        </div>
    );
}


