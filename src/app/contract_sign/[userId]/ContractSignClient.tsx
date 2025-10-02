"use client";

import { useEffect, useRef, useState } from "react";
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signature, setSignature] = useState<SignatureState>({
        hasDrawn: false,
        strokes: [],
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        const context = getCanvasContext();
        if (!context) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!signature.hasDrawn) {
            setError("Por favor firme el documento antes de continuar.");
            return;
        }

        if (!acceptTerms) {
            setError("Debes aceptar los términos y condiciones para continuar.");
            return;
        }

        setError(null);

        // TODO: Implement submission logic (e.g., upload signature, update Supabase)
        console.log("Signature submitted for", participant.id);
    };

    const documentSections = [
        {
            title: "Datos del Participante",
            fields: [
                { label: "Nombre completo", value: `${participant.names} ${participant.last_name_1} ${participant.last_name_2}`.trim() },
                { label: "Edad", value: participant.age },
                { label: "Género", value: participant.gender },
                { label: "Correo electrónico", value: participant.email },
                { label: "Número de teléfono", value: participant.phone_number },
                { label: "Identificación", value: participant.national_id },
            ],
        },
        {
            title: "Contacto de Emergencia",
            fields: [
                {
                    label: "Nombre y relación",
                    value: participant.emergency_contact || "No proporcionado",
                },
                {
                    label: "Teléfono de emergencia",
                    value: participant.emergency_contact_phone_number || "No proporcionado",
                },
            ],
        },
        {
            title: "Historial de Participación",
            fields: [
                {
                    label: "Fecha de registro",
                    value: new Date(participant.created_at).toLocaleDateString(),
                },
                {
                    label: "Estado de firma",
                    value: participant.has_signed ? "Documento firmado previamente" : "Pendiente de firma",
                },
            ],
        },
    ];

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Acuerdo de Participación en el Campamento
                    </h1>
                    <p className="mt-4 text-lg text-slate-600">
                        Por favor revisa cuidadosamente la información presentada y firma al final del documento para confirmar tu
                        participación.
                    </p>
                </div>

                <section className="bg-white shadow-2xl rounded-3xl border border-slate-200 overflow-hidden">
                    <header className="px-8 py-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-wider text-slate-500 font-semibold">Participante</p>
                                <h2 className="text-2xl font-bold text-slate-900">
                                    {participant.names} {participant.last_name_1} {participant.last_name_2}
                                </h2>
                            </div>
                        </div>
                    </header>

                    <article className="px-8 py-8 space-y-8">
                        {documentSections.map((section) => (
                            <div key={section.title} className="space-y-4">
                                <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">
                                    {section.title}
                                </h3>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                    {section.fields.map((field) => (
                                        <div key={field.label}>
                                            <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                                                {field.label}
                                            </dt>
                                            <dd className="mt-1 text-base text-slate-900 font-medium break-words">
                                                {field.value || "-"}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        ))}

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">
                                    Declaración de Aceptación
                                </h3>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Yo, <span className="font-semibold">{participant.names} {participant.last_name_1} {participant.last_name_2}</span>,
                                    certifico que la información proporcionada es correcta y autorizo mi participación en las actividades
                                    del campamento. Entiendo y acepto las normas de convivencia, los protocolos de seguridad y los términos
                                    establecidos por la organización.
                                </p>
                                <p className="mt-4 text-slate-700 leading-relaxed">
                                    Asimismo, libero de toda responsabilidad a la organización del campamento por cualquier eventualidad
                                    que pueda ocurrir durante las actividades, siempre y cuando se haya cumplido con los protocolos de
                                    seguridad establecidos.
                                </p>
                            </div>

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
                                            className="w-full rounded-2xl bg-white shadow-inner"
                                            onPointerDown={handlePointerDown}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                            onPointerLeave={handlePointerLeave}
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
                                        className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-base font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
                                        style={{ backgroundColor: "#9bc3db" }}
                                    >
                                        Enviar firma
                                    </button>
                                </div>
                            </form>
                        </div>
                    </article>
                </section>

                <footer className="mt-10 text-center text-sm text-slate-500">
                    <p>Si tienes preguntas o necesitas asistencia, contacta a nuestro equipo en campamento@vida.com.</p>
                </footer>
            </div>
        </div>
    );
}


