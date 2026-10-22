'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Wordmark from '@/components/Wordmark'
import StaffNav from '@/components/StaffNav'

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
    const [showAlreadyCheckedInDialog, setShowAlreadyCheckedInDialog] = useState<boolean>(false)
    const [checkedInPersonName, setCheckedInPersonName] = useState<string>('')

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

            // Fetch user to check if already checked in
            const { data: userData, error: fetchError } = await supabase
                .from('People')
                .select('checked_in, names, last_name_1, last_name_2')
                .eq('id', userId)
                .single()

            if (fetchError) throw fetchError

            if (!userData) {
                throw new Error('Participant not found')
            }

            // Check if already checked in
            if (userData.checked_in) {
                const fullName = `${userData.names || ''} ${userData.last_name_1 || ''} ${userData.last_name_2 || ''}`.trim()
                setCheckedInPersonName(fullName)
                setShowAlreadyCheckedInDialog(true)

                // Stop scanning
                const reader = codeReaderRef.current as unknown as { stopContinuousDecode?: () => void }
                try { reader?.stopContinuousDecode?.() } catch { }
                const v: HTMLVideoElement | null = videoRef.current
                const stream = (v?.srcObject as MediaStream | null)
                try { stream?.getTracks().forEach(t => t.stop()) } catch { }
                if (v) (v as HTMLVideoElement).srcObject = null

                // Allow processing again after dialog closes
                hasProcessedRef.current = false
                return
            }

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

    const handleCloseDialog = () => {
        setShowAlreadyCheckedInDialog(false)
        setCheckedInPersonName('')
        router.push('/dashboard', { scroll: false })
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                    video::-webkit-media-controls {
                        display: none !important;
                    }
                    video::-webkit-media-controls-enclosure {
                        display: none !important;
                    }
                    video::-webkit-media-controls-panel {
                        display: none !important;
                    }
                    video::-webkit-media-controls-play-button {
                        display: none !important;
                    }
                    video::-webkit-media-controls-start-playback-button {
                        display: none !important;
                    }
                `
            }} />
            <header className="bg-oxblood">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Wordmark className="text-vermilion text-xl" />
                    <Link href="/dashboard" className="hidden items-center gap-1.5 rounded-lg border border-parchment/40 px-4 py-2 text-sm font-semibold text-parchment hover:bg-parchment/10 md:inline-flex">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Participants
                    </Link>
                </div>
            </header>
            <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center p-4 pb-24 md:pb-4">
                <h1 className="font-display text-2xl text-oxblood mb-4">Scan to check in</h1>
                {!secureContext && (
                    <p className="mb-3 text-sm text-oxblood">Camera requires HTTPS. Please use a secure URL or localhost.</p>
                )}
                {!supported && (
                    <p className="mb-3 text-sm text-oxblood">Camera API not supported on this device/browser.</p>
                )}
                <div className="w-full max-w-md rounded-2xl overflow-hidden border-4 border-oxblood bg-black aspect-[3/4]">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        autoPlay
                        controls={false}
                        style={{
                            WebkitPlaybackTargetAvailabilityButton: 'none',
                        } as React.CSSProperties}
                    ></video>
                </div>
                {/* auto-start camera; no manual button */}
                {status && <p className="mt-4 text-sm text-ink/80">{status}</p>}
                {error && (
                    <p className="mt-2 text-sm text-oxblood">{error}</p>
                )}

                {/* Already Checked In Dialog */}
                {showAlreadyCheckedInDialog && (
                    <div className="fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCloseDialog}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white rounded-2xl border border-ink/10 overflow-hidden animate-[slideIn_0.3s_ease-out]">
                                <div className="px-6 py-5 border-b border-ink/10 bg-parchment/60 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-vermilion">
                                            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-bold text-oxblood">Already Checked In</h3>
                                    </div>
                                    <button onClick={handleCloseDialog} className="text-ink/50 hover:text-ink transition-colors duration-200">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="px-6 py-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-oxblood">
                                            <span className="text-white font-bold text-xl">
                                                {checkedInPersonName.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="font-bold text-ink text-lg">{checkedInPersonName}</div>
                                            <div className="text-sm text-ink/70">is already checked in</div>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-vermilion/30 bg-vermilion/5 p-4 text-sm text-oxblood">
                                        <div className="flex items-start space-x-2">
                                            <svg className="h-5 w-5 text-vermilion flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="font-semibold">This participant has already been checked in. No action needed.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-ink/10 bg-white flex items-center justify-end gap-3">
                                    <button
                                        onClick={handleCloseDialog}
                                        className="px-6 py-3 rounded-lg text-sm font-semibold text-parchment bg-oxblood hover:bg-oxblood/90 transition-colors"
                                    >
                                        Return to Dashboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <StaffNav />
        </>
    )
}


