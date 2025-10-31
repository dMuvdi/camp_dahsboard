"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, getAllPeople } from "@/lib/supabase";
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
    const [guardianSelection, setGuardianSelection] = useState<"parent" | "delegate" | null>("parent");
    const [delegateNationalId, setDelegateNationalId] = useState("");
    const [delegateFullName, setDelegateFullName] = useState("");
    const [isSearchingDelegate, setIsSearchingDelegate] = useState(false);
    const [guardianName, setGuardianName] = useState("");
    const [guardianNationalId, setGuardianNationalId] = useState("");
    const [isValidatingGuardian, setIsValidatingGuardian] = useState(false);
    const [guardianValidationError, setGuardianValidationError] = useState("");
    const [todayFormatted, setTodayFormatted] = useState("");
    const [isMounted, setIsMounted] = useState(false);
    const isMinor = Number(participant.age) < 18;

    // Set mounted state and today's date on client side to avoid hydration mismatch
    useEffect(() => {
        setIsMounted(true);
        setTodayFormatted(new Date().toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }));
    }, []);

    const searchDelegateByNationalId = useCallback(async (searchValue: string) => {
        if (!isMinor) return;
        if (guardianSelection !== "delegate") return;
        const value = searchValue.trim();
        if (!value) {
            setDelegateFullName("");
            return;
        }
        setIsSearchingDelegate(true);
        try {
            const results = await getAllPeople({ p_national_id: value });
            if (Array.isArray(results) && results.length > 0) {
                const person = results[0];
                // Check for exact match - national_id must exactly match what was typed
                if (person.national_id === value) {
                    const full = `${person.names} ${person.last_name_1} ${person.last_name_2}`.trim();
                    setDelegateFullName(full);
                } else {
                    // Not an exact match, clear the name
                    setDelegateFullName("");
                }
            } else {
                setDelegateFullName("");
            }
        } catch {
            setDelegateFullName("");
        } finally {
            setIsSearchingDelegate(false);
        }
    }, [isMinor, guardianSelection]);

    const validateGuardianNationalId = async () => {
        if (!isMinor) return;
        if (guardianSelection !== "parent") return;
        const value = guardianNationalId.trim();
        if (!value) {
            setGuardianValidationError("");
            return;
        }
        setIsValidatingGuardian(true);
        setGuardianValidationError("");
        try {
            const results = await getAllPeople({ p_national_id: value });
            if (Array.isArray(results) && results.length === 0) {
                setGuardianValidationError("Para firmar el contrato debes ser un participante del campamento y estar registrado para el campamento.");
            } else {
                // Clear any previous error if validation passes
                setGuardianValidationError("");
            }
        } catch {
            setGuardianValidationError("Error al validar la información. Intenta nuevamente.");
        } finally {
            setIsValidatingGuardian(false);
        }
    };

    // Debounced search for delegate - only search after user stops typing
    useEffect(() => {
        if (!isMinor) return;
        if (guardianSelection !== "delegate") return;
        const value = delegateNationalId.trim();
        // If empty, ensure name is blank and don't schedule search
        if (!value) {
            setDelegateFullName("");
            return;
        }
        // Wait for user to stop typing before searching (800ms delay)
        const handle = window.setTimeout(() => {
            searchDelegateByNationalId(value);
        }, 800);
        return () => window.clearTimeout(handle);
    }, [isMinor, guardianSelection, delegateNationalId, searchDelegateByNationalId]);

    // Debounced validation for guardian national ID
    useEffect(() => {
        if (!isMinor) return;
        if (guardianSelection !== "parent") return;
        const value = guardianNationalId.trim();
        if (!value) {
            setGuardianValidationError("");
            return;
        }
        const handle = window.setTimeout(() => {
            validateGuardianNationalId();
        }, 800);
        return () => window.clearTimeout(handle);
    }, [isMinor, guardianSelection, guardianNationalId]);

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

        if (isMinor && guardianSelection === null) {
            setError("Por favor selecciona una de las opciones de autorización para menores.");
            return;
        }

        if (isMinor) {
            if (guardianSelection === "parent") {
                if (!guardianName.trim() || !guardianNationalId.trim()) {
                    setError("Por favor ingresa tu nombre y C.C. como padre/madre/tutor(a).");
                    return;
                }
                if (guardianValidationError) {
                    setError(guardianValidationError);
                    return;
                }
                if (isValidatingGuardian) {
                    setError("Por favor espera mientras validamos tu información.");
                    return;
                }
            }
            if (guardianSelection === "delegate" && !delegateNationalId.trim()) {
                setError("Por favor ingresa la C.C. del responsable seleccionado.");
                return;
            }
        }

        setError(null);
        setIsSubmitting(true);
        setSubmitStatus("idle");
        setPdfUrl(null);

        try {
            if (isMinor && guardianSelection === "parent") {
                // For minors with parent authorization, call create-minor-consent-pdf
                const canvas = canvasRef.current;
                if (!canvas) throw new Error("No se encontró el lienzo de firma");

                const signatureBlob: Blob = await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error("No se pudo generar la imagen de la firma"));
                    }, "image/png", 1);
                });

                // Get guardian ID from database using national_id
                const guardianResults = await getAllPeople({ p_national_id: guardianNationalId.trim() });
                if (!Array.isArray(guardianResults) || guardianResults.length === 0) {
                    throw new Error("No se encontró el padre/madre/tutor en la base de datos");
                }
                const guardianId = guardianResults[0].id;

                // Build FormData for minor consent PDF Edge Function
                const formData = new FormData();
                formData.append("signature_file", new File([signatureBlob], "signature.png", { type: "image/png" }));
                formData.append("minor_id", participant.id);
                formData.append("manager_id", guardianId);

                // Use Supabase anon key for Edge Function authentication
                const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                // Call Supabase Edge Function to create minor consent PDF
                const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-minor-consent-pdf`;
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

                // Scroll to top to show success message
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Store PDF URL in sessionStorage for the success page
                if (url) {
                    sessionStorage.setItem('pdfUrl', url);
                    sessionStorage.setItem('participantId', participant.national_id);
                }

                // Redirect to success page after a short delay
                setTimeout(() => {
                    router.push("/success");
                }, 2000);
            } else if (isMinor && guardianSelection === "delegate") {
                // For minors with delegate authorization, call minor-second-option-manager-assignment
                const canvas = canvasRef.current;
                if (!canvas) throw new Error("No se encontró el lienzo de firma");

                const signatureBlob: Blob = await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error("No se pudo generar la imagen de la firma"));
                    }, "image/png", 1);
                });

                // Get guardian ID from database using delegate national_id (from the delegate input field)
                const guardianResults = await getAllPeople({ p_national_id: delegateNationalId.trim() });
                if (!Array.isArray(guardianResults) || guardianResults.length === 0) {
                    throw new Error("No se encontró el responsable seleccionado en la base de datos");
                }
                const guardianId = guardianResults[0].id;

                // Build FormData for minor consent PDF Edge Function
                const formData = new FormData();
                formData.append("signature_file", new File([signatureBlob], "signature.png", { type: "image/png" }));
                formData.append("minor_id", participant.id);
                formData.append("manager_id", guardianId);
                formData.append("tutor_name", guardianName);
                formData.append("tutor_national_id", guardianNationalId);

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

            } else {
                // For adults, proceed with PDF generation
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

                // Scroll to top to show success message
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Store PDF URL in sessionStorage for the success page
                if (url) {
                    sessionStorage.setItem('pdfUrl', url);
                    sessionStorage.setItem('participantId', participant.national_id);
                }

                // Redirect to success page after a short delay
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
                                        {participant.names} {participant.last_name_1} {participant.last_name_2}
                                    </h2>
                                    {isMounted && isMinor && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                            Menor de edad
                                        </span>
                                    )}
                                </div>
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
                                {isMounted && isMinor ? (
                                    <>
                                        <p className="mt-4 text-slate-700 leading-relaxed">
                                            Yo,
                                            <input
                                                type="text"
                                                value={guardianName}
                                                onChange={(e) => setGuardianName(e.target.value)}
                                                placeholder="Nombre del padre/madre/tutor"
                                                className="mx-2 inline-block px-3 py-1 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                style={{ minWidth: 220 }}
                                            />
                                            identificado(a) con C.C. No.
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={guardianNationalId}
                                                onChange={(e) => setGuardianNationalId(e.target.value)}
                                                placeholder="Número de C.C."
                                                className="mx-2 inline-block px-3 py-1 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                style={{ minWidth: 180 }}
                                            />
                                            {guardianSelection === "parent" && isValidatingGuardian && (
                                                <span className="text-xs text-slate-500 ml-2">Validando...</span>
                                            )}
                                            , en calidad de padre, madre o tutor(a), autorizo la participación de mi hijo(a) {participant.names} {participant.last_name_1} {participant.last_name_2}, identificado(a) con T.I. No. {participant.national_id}, en la actividad RELEVANTE CAMP. Declaro que conozco el listado de actividades programadas para los campistas y acepto su participación en todas, salvo aquellas que se indiquen expresamente en las observaciones o anotaciones.
                                        </p>
                                        {guardianSelection === "parent" && guardianValidationError && (
                                            <div className="mt-2 p-3 rounded-lg border border-red-200 bg-red-50">
                                                <p className="text-sm text-red-700 font-semibold">{guardianValidationError}</p>
                                            </div>
                                        )}
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
                                    </>
                                ) : (
                                    <>
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
                                            Para los efectos legales pertinentes, suscribo el presente documento de forma voluntaria hoy {isMounted ? todayFormatted : ""}.
                                        </p>
                                    </>
                                )}
                            </div>

                            {isMounted && isMinor && (
                                <div className="space-y-4 mt-6">
                                    <label className="flex items-start space-x-3">
                                        <input
                                            type="checkbox"
                                            checked={guardianSelection === "parent"}
                                            onChange={() => setGuardianSelection("parent")}
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
                                            checked={guardianSelection === "delegate"}
                                            onChange={() => setGuardianSelection("delegate")}
                                            className="mt-3 h-3 w-3 rounded border border-slate-600 accent-blue-600 focus:ring-blue-500 transform scale-150"
                                        />
                                        <div className="flex-1 space-y-2">
                                            <span className="text-slate-900 leading-relaxed block">
                                                Por medio del presente documento, autorizo a {delegateFullName || "_______________________________"}, identificado con C.C. No. {delegateNationalId || "____________________"},
                                                para que actúe como responsable de mi hijo(a) durante el Campamento, vele por su seguridad y coopere con los organizadores
                                                en el cumplimiento de las medidas establecidas para su adecuada ejecución.
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="C.C. del responsable"
                                                    value={delegateNationalId}
                                                    onChange={(e) => { setDelegateNationalId(e.target.value); setDelegateFullName(""); }}
                                                    disabled={guardianSelection !== "delegate"}
                                                    className="w-full sm:w-64 px-4 py-2 rounded-xl border border-slate-600 text-slate-900 placeholder-slate-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
                                                />
                                                {isSearchingDelegate && (
                                                    <span className="text-xs text-slate-500">Buscando...</span>
                                                )}
                                            </div>
                                            {guardianSelection === "delegate" && delegateNationalId.trim() && !isSearchingDelegate && !delegateFullName && (
                                                <p className="text-xs font-semibold text-red-600">No se encontró ninguna persona con esa identificación.</p>
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


