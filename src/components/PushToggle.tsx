'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type State = 'loading' | 'unsupported' | 'install' | 'denied' | 'off' | 'on' | 'busy'

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

const help: Partial<Record<State, string>> = {
    install: 'En iPhone, abre esta página en Safari, toca Compartir y luego «Agregar a inicio». Activa las notificaciones desde el ícono de la app.',
    denied: 'Las notificaciones están bloqueadas para este sitio. Actívalas en los ajustes del navegador o del celular e intenta de nuevo.',
    unsupported: 'Este navegador no puede recibir notificaciones.',
}

function base64UrlToBytes(value: string) {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4))
    return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Bell in the staff header: registers the service worker and subscribes this device to "consent signed" pushes.
export default function PushToggle() {
    const [state, setState] = useState<State>('loading')
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            setState('unsupported')
            return
        }
        navigator.serviceWorker.register('/sw.js').then(async (registration) => {
            if (!('PushManager' in window) || !vapidKey) {
                // iOS only exposes Web Push to apps added to the home screen
                setState(/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'install' : 'unsupported')
            } else if (Notification.permission === 'denied') {
                setState('denied')
            } else {
                setState((await registration.pushManager.getSubscription()) ? 'on' : 'off')
            }
        }).catch(() => setState('unsupported'))
    }, [])

    const toggle = async () => {
        if (state !== 'on' && state !== 'off') {
            setMessage((current) => (current ? null : help[state] ?? null))
            return
        }
        setState('busy')
        setMessage(null)
        try {
            const registration = await navigator.serviceWorker.ready
            const existing = await registration.pushManager.getSubscription()
            if (existing) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', existing.endpoint)
                await existing.unsubscribe()
                setState('off')
                return
            }
            if ((await Notification.requestPermission()) !== 'granted') {
                setState('denied')
                setMessage(help.denied!)
                return
            }
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToBytes(vapidKey!),
            })
            const { keys } = subscription.toJSON()
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({ endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth })
            if (error) {
                await subscription.unsubscribe()
                throw error
            }
            setState('on')
        } catch (err) {
            console.error('Push subscription failed', err)
            setState('off')
            setMessage('No se pudieron activar las notificaciones. Intenta de nuevo.')
        }
    }

    const on = state === 'on'
    const label = on ? 'Desactivar notificaciones' : 'Activar notificaciones'

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => { void toggle() }}
                disabled={state === 'loading' || state === 'busy'}
                aria-pressed={on}
                aria-label={label}
                title={label}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-parchment transition-colors active:bg-white/20 disabled:opacity-50 md:rounded-lg md:bg-transparent md:border md:border-parchment/40 md:hover:bg-parchment/10"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            </button>
            {message && (
                <p role="status" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-ink/10 bg-white p-4 text-sm text-ink shadow-lg">
                    {message}
                </p>
            )}
        </div>
    )
}
