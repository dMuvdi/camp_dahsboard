'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase'

export default function ScanQrPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
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

        // capture current video element reference for cleanup outside of the cleanup function
        const v: HTMLVideoElement | null = videoRef.current

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

    const startScan = async () => {
        if (!codeReaderRef.current) return
        const reader = codeReaderRef.current
        try {
            setError('')
            setStatus('Requesting camera permission...')

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            }

            const video = videoRef.current!

            await reader.decodeFromConstraints(constraints, video, async (result) => {
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
                const video = videoRef.current!
                await codeReaderRef.current!.decodeFromConstraints({ video: { facingMode: { ideal: 'user' } }, audio: false }, video, async (result) => {
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
    }

    const handleDecoded = async (text: string) => {
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

            setStatus('Check-in updated! You can scan the next QR.')
        } catch (e: unknown) {
            const msg = (e as Error)?.message || 'Failed to process QR'
            setError(msg)
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
            {!hasStarted && (
                <button
                    onClick={startScan}
                    className="mt-4 px-5 py-2.5 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl"
                    style={{ backgroundColor: '#9bc3db' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8bb3d1')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#9bc3db')}
                >
                    Start Camera
                </button>
            )}
            {status && <p className="mt-4 text-sm text-gray-700">{status}</p>}
            {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}


