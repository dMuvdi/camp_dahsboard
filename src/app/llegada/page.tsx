'use client'

import { useCallback, useEffect, useState } from 'react'
import { camp } from '@/lib/camp'
import { consentFunctionUrl, consentHeaders } from '@/lib/consentApi'

// Opened by the NFC stickers on the staff badges (iPhone and Android open the link on their own) or the printed QR next
// to them: the camper taps with their own phone and is checked in, and on a later tap checked out. The phone remembers
// who they are, so only the first tap asks for the document number. Staff keep the QR scanner as the fallback.

const STORAGE_KEY = 'camper-id'
type Camper = { id: string; names: string; last_name_1: string; last_name_2: string | null }
type Screen =
    | { kind: 'loading' }
    | { kind: 'ask'; error?: string }
    | { kind: 'confirm'; camper: Camper }
    | { kind: 'done'; name: string; title: string; message: string; at: Date }
    | { kind: 'stop'; message: string }

const fullName = (p: Camper) => [p.names, p.last_name_1, p.last_name_2].filter(Boolean).join(' ')
const time = (d: Date) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
const post = (body: object) =>
    fetch(consentFunctionUrl, { method: 'POST', headers: { ...consentHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const remembered = () => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
const remember = (id: string | null) => {
    try {
        if (id) localStorage.setItem(STORAGE_KEY, id)
        else localStorage.removeItem(STORAGE_KEY)
    } catch { /* private mode: the next tap asks again */ }
}

export default function ArrivalPage() {
    const [screen, setScreen] = useState<Screen>({ kind: 'loading' })
    const [key, setKey] = useState('')
    const [nationalId, setNationalId] = useState('')
    const [busy, setBusy] = useState(false)

    const arrive = useCallback(async (k: string, id: string) => {
        setScreen({ kind: 'loading' })
        try {
            const res = await post({ action: 'arrive', key: k, id })
            const body = await res.json().catch(() => ({}))
            if (res.ok) {
                remember(id)
                navigator.vibrate?.([40, 60, 40])
                setScreen({ kind: 'done', name: body.name, title: body.title, message: body.message, at: new Date() })
            } else if (res.status === 400 || res.status === 404) {
                // the remembered camper no longer exists: ask who they are
                remember(null)
                setScreen({ kind: 'ask' })
            } else {
                setScreen({ kind: 'stop', message: body.error ?? 'No se pudo registrar. Acércate al staff.' })
            }
        } catch {
            setScreen({ kind: 'stop', message: 'No hay conexión. Revisa tus datos móviles e intenta de nuevo, o muéstrale tu código QR al staff.' })
        }
    }, [])

    const start = useCallback((k: string) => {
        if (!k) return setScreen({ kind: 'stop', message: 'Este enlace de llegada no es válido. Acércate al staff.' })
        const id = remembered()
        if (id) void arrive(k, id)
        else setScreen({ kind: 'ask' })
    }, [arrive])

    useEffect(() => {
        const k = new URLSearchParams(location.search).get('k') ?? ''
        setKey(k)
        start(k)
    }, [start])

    const find = async (e: React.FormEvent) => {
        e.preventDefault()
        const id = nationalId.replace(/[.\s-]/g, '')
        if (!id || busy) return
        setBusy(true)
        try {
            const res = await post({ action: 'lookup', nationalId: id })
            if (res.status === 400 || res.status === 404) setScreen({ kind: 'ask', error: 'No encontramos ese número entre los inscritos. Revísalo o acércate al staff.' })
            else if (!res.ok) throw new Error(`lookup: HTTP ${res.status}`)
            else setScreen({ kind: 'confirm', camper: await res.json() })
        } catch {
            setScreen({ kind: 'ask', error: 'No pudimos buscar tu número. Revisa tu conexión e intenta de nuevo.' })
        } finally {
            setBusy(false)
        }
    }

    const notMe = () => {
        remember(null)
        setNationalId('')
        setScreen({ kind: 'ask' })
    }

    if (screen.kind === 'done') {
        return (
            <main role="status" className="flex min-h-dvh flex-col items-center justify-center bg-glass px-6 py-12 text-center text-white">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-glass">
                    <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="mt-6 text-2xl font-bold">{screen.title}</h1>
                <p className="mt-4 font-display text-4xl leading-tight">{screen.name}</p>
                <p className="mt-2 text-lg text-white/85">{time(screen.at)}</p>
                <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/90">{screen.message}</p>
                <button type="button" onClick={notMe} className="mt-12 text-sm font-semibold text-white/80 underline underline-offset-4">
                    ¿No eres {screen.name.split(' ')[0]}? Cambiar de persona
                </button>
            </main>
        )
    }

    if (screen.kind === 'stop') {
        return (
            <main role="alert" className="flex min-h-dvh flex-col items-center justify-center bg-oxblood px-6 py-12 text-center text-parchment">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-parchment text-oxblood">
                    <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 4h.01" /></svg>
                </div>
                <h1 className="mt-6 text-2xl font-bold">No se registró</h1>
                <p className="mt-4 max-w-sm text-lg leading-relaxed">{screen.message}</p>
                <button type="button" onClick={() => start(key)} className="mt-10 h-14 w-full max-w-sm rounded-2xl bg-parchment text-base font-bold text-oxblood active:scale-[0.99]">
                    Intentar de nuevo
                </button>
                {remembered() && (
                    <button type="button" onClick={notMe} className="mt-6 text-sm font-semibold text-parchment/80 underline underline-offset-4">
                        Cambiar de persona
                    </button>
                )}
            </main>
        )
    }

    return (
        <main className="flex min-h-dvh flex-col bg-parchment">
            <header className="flex h-20 items-center justify-center bg-oxblood pt-[env(safe-area-inset-top)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/rev-camp-white.png" alt={camp.name} className="h-10 w-auto" />
            </header>
            <div className="mx-auto w-full max-w-md flex-1 px-6 py-10">
                {screen.kind === 'loading' && <p role="status" className="mt-16 text-center text-lg text-ink/70">Registrando…</p>}

                {screen.kind === 'ask' && (
                    <form onSubmit={find}>
                        <h1 className="font-display text-3xl text-oxblood">Llegada al campamento</h1>
                        <p className="mt-3 text-base leading-relaxed text-ink/80">
                            Escribe tu número de documento. Solo te lo pedimos la primera vez; después basta con acercar el celular.
                        </p>
                        <label htmlFor="national-id" className="mt-8 mb-1.5 block text-sm font-semibold text-ink">Cédula o tarjeta de identidad</label>
                        <input
                            id="national-id"
                            inputMode="numeric"
                            autoComplete="off"
                            autoFocus
                            value={nationalId}
                            onChange={(e) => setNationalId(e.target.value)}
                            aria-describedby={screen.error ? 'national-id-error' : undefined}
                            className="block h-14 w-full rounded-xl border border-ink/20 bg-white px-4 text-xl tracking-wide text-ink placeholder-ink/40 focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/25"
                        />
                        {screen.error && <p id="national-id-error" className="mt-3 text-sm font-semibold text-oxblood">{screen.error}</p>}
                        <button type="submit" disabled={busy || !nationalId.trim()} className="mt-6 h-14 w-full rounded-2xl bg-oxblood text-base font-bold text-parchment disabled:opacity-50 active:scale-[0.99]">
                            {busy ? 'Buscando…' : 'Continuar'}
                        </button>
                    </form>
                )}

                {screen.kind === 'confirm' && (
                    <div>
                        <h1 className="font-display text-3xl text-oxblood">¿Eres tú?</h1>
                        <p className="mt-6 text-3xl font-bold leading-tight text-ink">{fullName(screen.camper)}</p>
                        <button type="button" onClick={() => void arrive(key, screen.camper.id)} className="mt-10 h-14 w-full rounded-2xl bg-oxblood text-base font-bold text-parchment active:scale-[0.99]">
                            Sí, soy yo
                        </button>
                        <button type="button" onClick={notMe} className="mt-3 h-14 w-full rounded-2xl bg-ink/5 text-base font-bold text-ink/80">
                            No, volver
                        </button>
                    </div>
                )}
            </div>
            <p className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center text-sm text-ink/60">
                ¿Problemas? Muéstrale al staff el código QR de tu correo.
            </p>
        </main>
    )
}
