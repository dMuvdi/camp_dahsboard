"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, getAllPeople } from "@/lib/supabase";
import type { User } from "@/lib/supabase";

interface DelegateSignClientProps {
    minor: User;
}

interface SignatureState {
    hasDrawn: boolean;
    strokes: Path2D[];
}

export default function DelegateSignClient({
    minor,
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
    const [delegateNationalId, setDelegateNationalId] = useState("");
    const [delegateFullName, setDelegateFullName] = useState("");
    const [isLoadingManager, setIsLoadingManager] = useState(true);
    const [todayFormatted, setTodayFormatted] = useState("");
    const [isMounted, setIsMounted] = useState(false);

    // Fetch manager data using manager_id
    useEffect(() => {
        if (!minor.manager_id) {
            setIsLoadingManager(false);
            return;
        }

        const fetchManager = async () => {
            try {
                const { data, error } = await supabase
                    .from("People")
                    .select("*")
                    .eq("id", minor.manager_id)
                    .single();

                if (error || !data) {
                    console.error("Failed to fetch manager", error);
                    setError("No se pudo cargar la información del responsable.");
                    setIsLoadingManager(false);
                    return;
                }

                const manager = data as User;
                setDelegateNationalId(manager.national_id);
                setDelegateFullName(`${manager.names} ${manager.last_name_1} ${manager.last_name_2}`.trim());
                setIsLoadingManager(false);
            } catch (err) {
                console.error("Error fetching manager:", err);
                setError("Error al cargar la información del responsable.");
                setIsLoadingManager(false);
            }
        };

        fetchManager();
    }, [minor.manager_id]);

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

            // Get manager ID from database using delegate national_id
            const managerResults = await getAllPeople({ p_national_id: delegateNationalId.trim() });
            if (!Array.isArray(managerResults) || managerResults.length === 0) {
                throw new Error("No se encontró el responsable seleccionado en la base de datos");
            }
            const managerId = managerResults[0].id;

            // Build FormData for minor consent PDF Edge Function
            const formData = new FormData();
            formData.append("signature_file", new File([signatureBlob], "signature.png", { type: "image/png" }));
            formData.append("minor_id", minor.id);
            formData.append("manager_id", managerId);
            formData.append("tutor_name", minor.tutor_name || "");
            formData.append("tutor_national_id", minor.tutor_national_id || "");

            // Use Supabase anon key for Edge Function authentication
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            // Call Supabase Edge Function to create minor consent PDF
            const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/minor-second-option-manager-assignment`;
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
                throw new Error(text || "No se pudo generar el PDF para menor");
            }

            const pdfBlob = await response.blob();
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);

            // Update has_signed flag via RPC
            const { error: updateError } = await supabase.rpc('update_person', {
                p_age: minor.age,
                p_checked_in: minor.checked_in,
                p_checked_out: minor.checked_out,
                p_email: minor.email,
                p_emergency_contact: minor.emergency_contact,
                p_emergency_contact_phone_number: minor.emergency_contact_phone_number,
                p_has_signed: true,
                p_id: minor.id,
                p_last_name_1: minor.last_name_1,
                p_last_name_2: minor.last_name_2,
                p_names: minor.names,
                p_national_id: minor.national_id,
                p_phone_number: minor.phone_number
            });

            if (updateError) {
                // Not fatal for user experience, but log for debugging
                console.error('Failed to update has_signed:', updateError);
            }

            setSubmitStatus("success");

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Store PDF URL in sessionStorage for the success page
            if (url) {
                sessionStorage.setItem('pdfUrl', url);
                sessionStorage.setItem('participantId', minor.national_id);
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
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-slate-900">
                                        {minor.names} {minor.last_name_1} {minor.last_name_2}
                                    </h2>
                                    {isMounted && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                            Menor de edad
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-600 mt-1">C.C. {minor.national_id}</p>
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
                                    Yo, {minor.tutor_name || "_______________________________"}, identificado(a) con C.C. No. {minor.tutor_national_id || "____________________"},
                                    , en calidad de padre, madre o tutor(a), autorizo la participación de mi hijo(a) {minor.names} {minor.last_name_1} {minor.last_name_2}, identificado(a) con T.I. No. {minor.national_id}, en la actividad RELEVANTE CAMP. Declaro que conozco el listado de actividades programadas para los campistas y acepto su participación en todas, salvo aquellas que se indiquen expresamente en las observaciones o anotaciones.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Acepto y entiendo que el personal que dirigirá el Campamento se esfuerza por proporcionar un ambiente seguro y supervisado; sin embargo, reconozco que existen ciertos riesgos inherentes a las actividades al aire libre, así como la posibilidad de situaciones imprevistas. Entiendo que el Campamento adoptará todas las medidas razonables para garantizar la seguridad de los participantes; por ello, eximo de responsabilidad a la Iglesia Centro Bíblico Internacional y a los organizadores del evento por cualquier lesión, pérdida o daño material o personal que pueda ocurrir durante el Campamento, siempre que no medie dolo o culpa grave de su parte.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Autorizo a los organizadores del Campamento a utilizar fotografías, videos u otros medios de grabación que incluyan la imagen de mi hijo(a), con fines promocionales o educativos, siempre que no se vulnere su integridad ni su privacidad. Entiendo que las actividades del Campamento se realizarán en el predio privado La Niclala, ubicado en la Isla de Bocachica, cuyas instalaciones, zonas de descanso, piscinas y servicios de alimentación son proporcionados por la Finca La Niclala, y no por la Iglesia Centro Bíblico Internacional de Cartagena. En consecuencia, libero de toda responsabilidad al Campamento y a la Iglesia respecto de los servicios prestados por la Finca La Niclala. También reconozco que empresas privadas serán las encargadas del transporte marítimo a los campistas desde la ciudad de Cartagena hasta la Isla de Bocachica.

                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    En ese sentido, autorizo de manera voluntaria y libre la participación de mi hijo(a) en el Campamento RELEVANTE CAMP, comprometiéndome a que cumpla las indicaciones generales del evento anexas a este documento. Acepto las restricciones de seguridad y salubridad que se consideren necesarias, y promoveré las acciones de autocuidado pertinentes.

                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Por otra parte, manifiesto de manera voluntaria mi decisión de autorizar el viaje y la participación de mi hijo(a) en el Campamento, comprometiéndome a no presentar denuncia, queja o acción alguna frente a la Iglesia Centro Bíblico Internacional de Cartagena por hechos derivados de esta actividad. Así mismo, me comprometo a proveer a mi hijo(a) el equipo de protección personal necesario y a garantizar que cumpla las normas de bioseguridad establecidas para la protección y bienestar de todos los participantes.
                                </p>
                            </div>

                            {isMounted && (
                                <div className="space-y-4 mt-6">
                                    <label className="flex items-start space-x-3 opacity-50 cursor-not-allowed">
                                        <input
                                            type="checkbox"
                                            checked={false}
                                            disabled
                                            className="mt-3 h-3 w-3 rounded border border-slate-600 accent-blue-600 focus:ring-blue-500 transform scale-150"
                                        />
                                        <span className=" text-slate-900 leading-relaxed">
                                            En virtud de mi participación en el Campamento, me comprometo a velar por la seguridad e integridad de mi hijo(a)
                                            durante el desarrollo de las actividades, y a colaborar con los organizadores cumpliendo con las normas establecidas
                                            para el evento.
                                        </span>
                                    </label>

                                    <label className="flex items-start space-x-3">
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            disabled
                                            className="mt-3 h-3 w-3 rounded border border-slate-600 accent-blue-600 focus:ring-blue-500 transform scale-150"
                                        />
                                        <div className="flex-1 space-y-2">
                                            <span className="text-slate-900 leading-relaxed block">
                                                Por medio del presente documento, autorizo a {isLoadingManager ? "..." : (delegateFullName || "_______________________________")}, identificado con C.C. No. {isLoadingManager ? "..." : (delegateNationalId || "____________________")},
                                                para que actúe como responsable de mi hijo(a) durante el Campamento, vele por su seguridad y coopere con los organizadores
                                                en el cumplimiento de las medidas establecidas para su adecuada ejecución.
                                            </span>
                                            {isLoadingManager && (
                                                <p className="text-xs text-slate-500">Cargando información del responsable...</p>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            )}

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
                                        <div className="mt-4 col grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700">
                                            <div>
                                                <span className="font-semibold">Nombre:</span>
                                                <span className="ml-2">{minor.names} {minor.last_name_1} {minor.last_name_2}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">C.C.:</span>
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
                                            disabled={isSubmitting || isLoadingManager || !delegateNationalId || !delegateFullName}
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

