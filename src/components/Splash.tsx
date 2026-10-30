'use client'

import { useEffect, useState } from 'react'

// Branded launch screen for the staff app. Server-rendered so it covers the first paint, then fades out;
// shown once per browser session so moving between screens stays instant.
export default function Splash() {
    const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show')

    useEffect(() => {
        let seen = false
        try {
            seen = sessionStorage.getItem('splash-seen') === '1'
            sessionStorage.setItem('splash-seen', '1')
        } catch { /* private mode: show it every time */ }
        if (seen) {
            setPhase('gone')
            return
        }
        const fade = window.setTimeout(() => setPhase('fade'), 900)
        const gone = window.setTimeout(() => setPhase('gone'), 1300)
        return () => {
            window.clearTimeout(fade)
            window.clearTimeout(gone)
        }
    }, [])

    if (phase === 'gone') return null

    return (
        <div
            aria-hidden="true"
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-oxblood transition-opacity duration-300 ${phase === 'fade' ? 'opacity-0' : 'opacity-100'}`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/rev-camp-white.png" alt="" className="h-20 w-auto animate-[splashIn_0.6s_ease-out]" />
        </div>
    )
}
