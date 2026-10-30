'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const icons = {
    people: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    scan: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    add: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
}

const Icon = ({ d, className = 'h-6 w-6' }: { d: string; className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
)

// Floating tab bar for the installed staff app on phones; standalone mode has no browser back button.
// Scan sits in the middle because it is the main job at the dock.
export default function StaffNav({ onAdd }: { onAdd?: () => void }) {
    const pathname = usePathname()
    const tab = (active: boolean) =>
        `flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition-colors active:bg-ink/5 ${active ? 'text-oxblood' : 'text-ink/50'}`

    return (
        <nav
            aria-label="Secciones"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 select-none rounded-[26px] bg-white/95 px-2 shadow-[0_8px_30px_-8px_rgb(20_40_64/0.35)] ring-1 ring-ink/5 backdrop-blur md:hidden"
        >
            <div className="grid grid-cols-3 items-center">
                <Link href="/dashboard" aria-current={pathname === '/dashboard' ? 'page' : undefined} className={tab(pathname === '/dashboard')}>
                    <Icon d={icons.people} />
                    Participantes
                </Link>
                <Link
                    href="/scan-qr"
                    aria-current={pathname === '/scan-qr' ? 'page' : undefined}
                    aria-label="Escanear QR"
                    className="mx-auto -mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-oxblood text-parchment shadow-[0_10px_24px_-8px_rgb(79_1_0/0.7)] ring-4 ring-canvas transition-transform active:scale-95"
                >
                    <Icon d={icons.scan} className="h-7 w-7" />
                </Link>
                {onAdd ? (
                    <button type="button" onClick={onAdd} className={tab(false)}>
                        <Icon d={icons.add} />
                        Agregar
                    </button>
                ) : (
                    <Link href="/dashboard?add=1" className={tab(false)}>
                        <Icon d={icons.add} />
                        Agregar
                    </Link>
                )}
            </div>
        </nav>
    )
}
