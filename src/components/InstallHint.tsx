'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const KEY = 'install-hint-dismissed'

// Shown on phones that opened the staff app in the browser instead of from the home screen icon
export default function InstallHint({ className = '' }: { className?: string }) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
        const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        let dismissed = false
        try { dismissed = localStorage.getItem(KEY) === '1' } catch { /* private mode */ }
        setShow(phone && !standalone && !dismissed)
    }, [])

    if (!show) return null

    return (
        <div className={`flex items-center gap-3 rounded-[20px] bg-white p-3 pr-2 shadow-card ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 flex-none rounded-xl" />
            <Link href="/instalar" className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Instala la app en tu celular</span>
                <span className="block text-xs text-ink/60">Ábrela desde la pantalla de inicio, como cualquier app.</span>
            </Link>
            <button
                type="button"
                aria-label="Ocultar"
                onClick={() => {
                    setShow(false)
                    try { localStorage.setItem(KEY, '1') } catch { /* private mode */ }
                }}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink/40 active:bg-ink/5"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}
