'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase'
import { camp } from '@/lib/camp'
import Wordmark from '@/components/Wordmark'
import StaffNav from '@/components/StaffNav'

// One QR per camper: the first scan checks them in, the next one checks them out. Each action has its time window
// (lib/camp); outside it the scanner asks for confirmation instead of refusing, for late arrivals and early departures.

type Person = {
    id: string; names: string; last_name_1: string; last_name_2: string | null; national_id: string; age: number
    checked_in: boolean | null; checked_out: boolean | null; has_signed: boolean | null
}
type Action = 'in' | 'out'
type Result =
    | { kind: 'done'; action: Action; person: Person; at: Date }
    | { kind: 'confirm'; action: Action; person: Person; reasons: string[] }
    | { kind: 'info'; title: string; message: string; person: Person }
    | { kind: 'error'; message: string }

const actionLabel = { in: 'check-in', out: 'check-out' } as const
const fullName = (p: Person) => [p.names, p.last_name_1, p.last_name_2].filter(Boolean).join(' ')
const idLabel = (p: Person) => `${Number(p.age) < 18 ? 'T.I.' : 'C.C.'} ${p.national_id}`
const inWindow = (w: { start: string; end: string }, now = new Date()) => now >= new Date(w.start) && now <= new Date(w.end)
const time = (d: Date) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })

export default function ScanQrPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    // decodes keep firing while a result is on screen; this drops them until the staff member moves on
    const busyRef = useRef(false)
    const [result, setResult] = useState<Result | null>(null)
    const [status, setStatus] = useState('Iniciando la cámara…')
    const [cameraError, setCameraError] = useState('')

    const register = useCallback(async (action: Action, person: Person) => {
        // only the one flag changes, so a stale copy of the row can't undo other fields
        const { error } = await supabase.from('People').update(action === 'in' ? { checked_in: true } : { checked_out: true }).eq('id', person.id)
        if (error) {
            setResult({ kind: 'error', message: 'No se pudo guardar el registro. Revisa la conexión e intenta de nuevo.' })
            return
        }
        navigator.vibrate?.([40, 60, 40])
        setResult({ kind: 'done', action, person, at: new Date() })
    }, [])

    const onScan = useCallback(async (text: string) => {
        if (busyRef.current) return
        busyRef.current = true
        navigator.vibrate?.(30)
        setStatus('Buscando al campista…')
        try {
            const { data, error } = await supabase
                .from('People')
                .select('id, names, last_name_1, last_name_2, national_id, age, checked_in, checked_out, has_signed')
                .eq('id', text.trim())
                .maybeSingle()
            if (error || !data) {
                setResult({ kind: 'error', message: 'Este código no corresponde a ningún campista inscrito.' })
                return
            }
            const person = data as Person
            if (person.checked_out) {
                setResult({ kind: 'info', title: 'Ya hizo check-out', message: 'Este campista ya salió del campamento.', person })
                return
            }
            const action: Action = person.checked_in ? 'out' : 'in'
            const reasons: string[] = []
            if (action === 'in' && !person.has_signed) reasons.push('No ha firmado el consentimiento.')
            if (action === 'in' && !inWindow(camp.checkIn)) reasons.push(`El check-in es el ${camp.checkIn.label}.`)
            if (action === 'out' && !inWindow(camp.checkOut)) reasons.push(`Ya tiene check-in. El check-out es el ${camp.checkOut.label}.`)
            if (reasons.length) setResult({ kind: 'confirm', action, person, reasons })
            else await register(action, person)
        } catch {
            setResult({ kind: 'error', message: 'No se pudo leer el código. Revisa la conexión e intenta de nuevo.' })
        }
    }, [register])

    const next = useCallback(() => {
        setResult(null)
        setStatus('Apunta la cámara al código QR')
        busyRef.current = false
    }, [])

    // after a successful scan the scanner is ready for the next camper on its own
    useEffect(() => {
        if (result?.kind !== 'done') return
        const t = window.setTimeout(next, 4000)
        return () => window.clearTimeout(t)
    }, [result, next])

    useEffect(() => {
        const reader = new BrowserMultiFormatReader()
        const video = videoRef.current
        const secure = location.protocol === 'https:' || location.hostname === 'localhost'
        if (!secure) {
            setCameraError('La cámara necesita una conexión segura (https).')
            return
        }
        if (!navigator.mediaDevices?.getUserMedia || !video) {
            setCameraError('Este navegador no permite usar la cámara.')
            return
        }
        let controls: { stop: () => void } | undefined
        const start = (facingMode: string) =>
            reader.decodeFromConstraints({ video: { facingMode: { ideal: facingMode } }, audio: false }, video, (r) => {
                if (r) void onScan(r.getText())
            })
        start('environment')
            .catch(() => start('user'))
            .then((c) => {
                controls = c
                setStatus('Apunta la cámara al código QR')
            })
            .catch(() => setCameraError('No pudimos abrir la cámara. Revisa que la app tenga permiso para usarla.'))
        return () => {
            controls?.stop()
            const stream = video.srcObject as MediaStream | null
            stream?.getTracks().forEach((t) => t.stop())
            video.srcObject = null
        }
    }, [onScan])

    return (
        <>
            <header className="bg-oxblood pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/rev-camp-white.png" alt="Revelation Camp" className="h-8 w-auto md:hidden" />
                    <span className="hidden md:block"><Wordmark className="text-vermilion text-xl" /></span>
                    <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-lg border border-parchment/40 px-4 py-2 text-sm font-semibold text-parchment hover:bg-parchment/10 md:inline-flex">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Participantes
                    </Link>
                </div>
            </header>

            {/* phones get a dark, full-bleed camera screen like a native scanner */}
            <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col items-center justify-center bg-ink p-4 pb-36 md:min-h-[calc(100svh-4rem)] md:bg-parchment md:pb-4">
                <h1 className="font-display text-2xl text-parchment md:text-oxblood">Escanear QR</h1>
                <p className="mb-4 mt-1 text-center text-sm text-parchment/70 md:text-ink/70">
                    El mismo código registra la llegada y, en una segunda lectura, la salida.
                </p>
                <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10 aspect-[3/4] md:rounded-2xl md:border-4 md:border-oxblood md:ring-0">
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay controls={false} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <div className="aspect-square h-[58%] rounded-3xl border-2 border-white/70 shadow-[0_0_0_9999px_rgb(0_0_0/0.25)]" />
                    </div>
                </div>
                <p role="status" className="mt-4 text-sm text-parchment/80 md:text-ink/80">{cameraError || status}</p>
            </div>

            {result && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="scan-result-title">
                    <div className="w-full max-w-md rounded-t-[28px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 animate-[sheetUp_0.25s_ease-out] md:rounded-3xl md:pb-6">
                        {result.kind === 'done' && (
                            <div className="text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-glass text-white">
                                    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h2 id="scan-result-title" className="mt-4 text-xl font-bold text-glass">
                                    {result.action === 'in' ? 'Check-in registrado' : 'Check-out registrado'}
                                </h2>
                                <p className="mt-3 text-2xl font-bold text-ink">{fullName(result.person)}</p>
                                <p className="mt-1 text-sm text-ink/60">{idLabel(result.person)} · {time(result.at)}</p>
                                <button type="button" onClick={next} className="mt-6 h-12 w-full rounded-2xl bg-oxblood text-base font-bold text-parchment active:scale-[0.99]">
                                    Escanear siguiente
                                </button>
                            </div>
                        )}

                        {result.kind === 'confirm' && (
                            <div>
                                <h2 id="scan-result-title" className="text-xl font-bold text-oxblood">¿Registrar el {actionLabel[result.action]}?</h2>
                                <p className="mt-3 text-2xl font-bold text-ink">{fullName(result.person)}</p>
                                <p className="mt-1 text-sm text-ink/60">{idLabel(result.person)}</p>
                                <ul className="mt-4 space-y-2">
                                    {result.reasons.map((r) => (
                                        <li key={r} className="rounded-xl bg-vermilion/10 px-4 py-3 text-sm font-semibold text-oxblood">{r}</li>
                                    ))}
                                </ul>
                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <button type="button" onClick={next} className="h-12 rounded-2xl bg-ink/5 text-sm font-bold text-ink/80">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={() => void register(result.action, result.person)} className="h-12 rounded-2xl bg-oxblood text-sm font-bold text-parchment">
                                        Registrar {actionLabel[result.action]}
                                    </button>
                                </div>
                            </div>
                        )}

                        {result.kind === 'info' && (
                            <div className="text-center">
                                <h2 id="scan-result-title" className="text-xl font-bold text-ink">{result.title}</h2>
                                <p className="mt-3 text-2xl font-bold text-ink">{fullName(result.person)}</p>
                                <p className="mt-1 text-sm text-ink/60">{result.message}</p>
                                <button type="button" onClick={next} className="mt-6 h-12 w-full rounded-2xl bg-oxblood text-base font-bold text-parchment">
                                    Escanear siguiente
                                </button>
                            </div>
                        )}

                        {result.kind === 'error' && (
                            <div className="text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-vermilion text-white">
                                    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </div>
                                <h2 id="scan-result-title" className="mt-4 text-xl font-bold text-oxblood">No se registró</h2>
                                <p className="mt-2 text-ink/70">{result.message}</p>
                                <button type="button" onClick={next} className="mt-6 h-12 w-full rounded-2xl bg-oxblood text-base font-bold text-parchment">
                                    Intentar de nuevo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <StaffNav />
        </>
    )
}
