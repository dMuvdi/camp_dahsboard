'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
    {
        href: '/dashboard',
        label: 'Participants',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
        href: '/scan-qr',
        label: 'Scan QR',
        icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    },
]

// Bottom tab bar for the installed staff app on phones; there is no browser back button in standalone mode.
export default function StaffNav() {
    const pathname = usePathname()
    return (
        <nav aria-label="Staff sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
            <div className="grid grid-cols-2">
                {tabs.map((tab) => {
                    const active = pathname === tab.href
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${active ? 'text-oxblood' : 'text-ink/55'}`}
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8} d={tab.icon} />
                            </svg>
                            {tab.label}
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
