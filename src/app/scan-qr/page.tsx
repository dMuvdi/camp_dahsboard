'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase'

export default function ScanQrPage() {
    const router = useRouter()
    const videoRef = useRef<HTMLVideoElement>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
    const hasProcessedRef = useRef<boolean>(false)
    // scanning state not required for UI; keep logic simple
    const [error, setError] = useState<string>('')
    const [status, setStatus] = useState<string>('')
    const [supported, setSupported] = useState<boolean>(true)
    const [secureContext, setSecureContext] = useState<boolean>(true)
    const [hasStarted, setHasStarted] = useState<boolean>(false)

    useEffect(() => {
        const reader = new BrowserMultiFormatReader()
        codeReaderRef.current = reader

        // Basic support checks
        const isSecure = typeof window !== 'undefined' ? (location.protocol === 'https:' || location.hostname === 'localhost') : true
        setSecureContext(isSecure)
        const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
        setSupported(hasMedia)

        // Auto-start camera immediately when possible
        const v: HTMLVideoElement | null = videoRef.current
        if (isSecure && hasMedia && v) {
            ; (async () => {
                try {
                    setError('')
                    setStatus('Requesting camera permission...')
                    await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, v, async (result) => {
                        if (result) {
                            const text = result.getText()
                            await handleDecoded(text)
                        }
                    })
                    setStatus('Point the camera at the QR code')
                    setHasStarted(true)
                } catch (e: unknown) {
                    // Fallback to user-facing camera if env camera not accessible
                    try {
                        await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'user' } }, audio: false }, v, async (result) => {
                            if (result) {
                                const text = result.getText()
                                await handleDecoded(text)
                            }
                        })
                        setStatus('Point the camera at the QR code')
                        setHasStarted(true)
                    } catch (err: unknown) {
                        const msg = (err as Error)?.message || (e as Error)?.message || 'Failed to start camera'
                        setError(msg)
                    }
                }
            })()
        }

        return () => {
            // Gracefully stop continuous decoding if available
            const stop = (reader as unknown as { stopContinuousDecode?: () => void }).stopContinuousDecode
            if (typeof stop === 'function') {
                try { stop() } catch { }
            }
            // Stop the camera stream
            const stream = (v?.srcObject as MediaStream | null)
            try { stream?.getTracks().forEach(t => t.stop()) } catch { }
            if (v) (v as HTMLVideoElement).srcObject = null
            codeReaderRef.current = null
        }
    }, [])

    // startScan removed; auto-start handled in mount effect

    const handleDecoded = async (text: string) => {
        // Guard: ensure we only process the first successful decode
        if (hasProcessedRef.current) return
        hasProcessedRef.current = true
        try {
            // Assume the QR encodes only the userId
            const userId = text.trim()
            setStatus('Verifying participant...')

            // Optional: fetch to verify user exists
            // Update check-in via RPC
            const { error } = await supabase.rpc('update_person', {
                p_age: null,
                p_checked_in: true,
                p_checked_out: null,
                p_email: null,
                p_emergency_contact: null,
                p_emergency_contact_phone_number: null,
                p_has_signed: null,
                p_id: userId,
                p_last_name_1: null,
                p_last_name_2: null,
                p_names: null,
                p_national_id: null,
                p_phone_number: null,
            })

            if (error) throw error

            // Stop further scanning immediately after a successful update
            const reader = codeReaderRef.current as unknown as { stopContinuousDecode?: () => void }
            try { reader?.stopContinuousDecode?.() } catch { }
            const v: HTMLVideoElement | null = videoRef.current
            const stream = (v?.srcObject as MediaStream | null)
            try { stream?.getTracks().forEach(t => t.stop()) } catch { }
            if (v) (v as HTMLVideoElement).srcObject = null

            setStatus('Check-in updated! Returning to dashboard...')
            setTimeout(() => router.push('/dashboard', { scroll: false }), 350)
        } catch (e: unknown) {
            const msg = (e as Error)?.message || 'Failed to process QR'
            setError(msg)
            // Allow retry if there was an error
            hasProcessedRef.current = false
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold mb-4">Scan QR - Check-in</h1>
            {!secureContext && (
                <p className="mb-3 text-sm text-red-600">Camera requires HTTPS. Please use a secure URL or localhost.</p>
            )}
            {!supported && (
                <p className="mb-3 text-sm text-red-600">Camera API not supported on this device/browser.</p>
            )}
            <div className="w-full max-w-md rounded-xl overflow-hidden shadow-lg border bg-black aspect-[3/4]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay></video>
            </div>
            {/* auto-start camera; no manual button */}
            {status && <p className="mt-4 text-sm text-gray-700">{status}</p>}
            {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}


