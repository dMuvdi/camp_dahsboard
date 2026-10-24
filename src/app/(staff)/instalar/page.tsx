'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Platform = 'ios' | 'android'

// Chrome's install prompt event (not in the TS DOM lib yet)
type InstallPromptEvent = Event & { prompt: () => Promise<void> }

const shareIcon = (
    <svg className="inline h-5 w-5 align-[-4px] text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="Compartir">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
)
const menuIcon = (
    <svg className="inline h-5 w-5 align-[-4px]" fill="currentColor" viewBox="0 0 24 24" aria-label="Menú">
        <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
    </svg>
)

const steps: Record<Platform, React.ReactNode[]> = {
    ios: [
        <>Abre esta página en <strong>Safari</strong>.</>,
        <>Toca el botón Compartir {shareIcon} en la barra de abajo.</>,
        <>Desliza hacia abajo y toca <strong>Agregar a inicio</strong>.</>,
        <>Toca <strong>Agregar</strong>, arriba a la derecha.</>,
        <>Abre <strong>Revelation</strong> desde el ícono en tu pantalla de inicio y activa las notificaciones con la campana.</>,
    ],
    android: [
        <>Abre esta página en <strong>Chrome</strong>.</>,
        <>Toca el menú {menuIcon} arriba a la derecha.</>,
        <>Toca <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</>,
        <>Confirma con <strong>Instalar</strong>.</>,
        <>Abre <strong>Revelation</strong> desde el ícono y activa las notificaciones con la campana.</>,
    ],
}

export default function InstallPage() {
    const router = useRouter()
    const [platform, setPlatform] = useState<Platform>('ios')
    const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)

    useEffect(() => {
        // Opened from the home screen icon: the app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            router.replace('/dashboard')
            return
        }
        if (/Android/i.test(navigator.userAgent)) setPlatform('android')
        const onPrompt = (e: Event) => {
            e.preventDefault()
            setInstallEvent(e as InstallPromptEvent)
        }
        window.addEventListener('beforeinstallprompt', onPrompt)
        return () => window.removeEventListener('beforeinstallprompt', onPrompt)
    }, [router])

    return (
        <div className="min-h-[100dvh] bg-canvas pb-12">
            <header className="bg-oxblood pt-[env(safe-area-inset-top)] text-parchment">
                <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/rev-camp-white.png" alt="Revelation Camp" className="h-8 w-auto" />
                    <Link href="/login" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold active:bg-white/20">
                        Iniciar sesión
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-xl px-4 pt-6">
                <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-[18px] shadow-card" />
                    <div>
                        <h1 className="font-display text-[1.75rem] leading-tight text-oxblood">Instala la app</h1>
                        <p className="text-sm text-ink/60">Para el equipo de Revelation Camp: lista, escáner y avisos en tu celular.</p>
                    </div>
                </div>

                <div role="tablist" aria-label="Sistema del celular" className="mt-6 grid grid-cols-2 rounded-full bg-ink/5 p-1">
                    {(['ios', 'android'] as const).map((p) => (
                        <button
                            key={p}
                            role="tab"
                            type="button"
                            aria-selected={platform === p}
                            onClick={() => setPlatform(p)}
                            className={`rounded-full py-2.5 text-sm font-semibold transition-colors ${platform === p ? 'bg-white text-ink shadow-card' : 'text-ink/60'}`}
                        >
                            {p === 'ios' ? 'iPhone' : 'Android'}
                        </button>
                    ))}
                </div>

                {platform === 'android' && installEvent && (
                    <button
                        type="button"
                        onClick={() => { void installEvent.prompt(); setInstallEvent(null) }}
                        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-oxblood text-base font-bold text-parchment active:scale-[0.99]"
                    >
                        Instalar ahora
                    </button>
                )}

                <ol className="mt-5 space-y-3">
                    {steps[platform].map((step, i) => (
                        <li key={i} className="flex gap-4 rounded-[20px] bg-white p-4 shadow-card">
                            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-oxblood/10 text-sm font-bold text-oxblood" aria-hidden="true">
                                {i + 1}
                            </span>
                            <p className="pt-1 leading-relaxed text-ink/85">{step}</p>
                        </li>
                    ))}
                </ol>

                <p className="mt-6 text-center text-sm text-ink/55">
                    {platform === 'ios'
                        ? 'En iPhone las notificaciones solo funcionan cuando abres la app desde el ícono.'
                        : 'Si no ves la opción, actualiza Chrome y vuelve a abrir esta página.'}
                </p>
            </main>
        </div>
    )
}
