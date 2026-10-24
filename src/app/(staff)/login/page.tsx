'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Wordmark from '@/components/Wordmark'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                setError(error.message)
            } else {
                router.push('/dashboard')
            }
        } catch (error) {
            setError('An unexpected error occurred: ' + error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[100dvh] flex flex-col bg-oxblood lg:items-center lg:justify-center lg:bg-parchment lg:py-12 lg:px-8">
            {/* phones: brand on the oxblood top, form in a sheet like a native sign-in */}
            <div className="flex flex-col items-center gap-4 px-6 pb-10 pt-[calc(env(safe-area-inset-top)+3.5rem)] lg:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/rev-camp-white.png" alt="Revelation Camp" className="h-20 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/vida_logo_white.PNG" alt="Ministerio Juvenil VIDA" className="h-8 w-auto opacity-80" />
            </div>
            <div className="max-w-5xl w-full flex-1 flex flex-col lg:flex-none">
                <div className="flex-1 bg-white rounded-t-[28px] overflow-hidden flex flex-col lg:flex-none lg:flex-row lg:rounded-2xl lg:border lg:border-ink/10">
                    {/* Left Section - Login Form */}
                    <div className="w-full lg:w-1/2 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] lg:p-12 flex lg:items-center">
                        <div className="w-full max-w-sm mx-auto">
                            <div className="hidden lg:flex items-center justify-between mb-10">
                                <Wordmark className="lg:hidden text-vermilion text-lg" />
                                <Image
                                    src="/logos/vida_logo_black.PNG"
                                    alt="Vida Ministerio Juvenil"
                                    width={240}
                                    height={160}
                                    priority
                                    className="h-14 w-auto object-contain"
                                />
                            </div>

                            <h1 className="font-display text-3xl text-oxblood mb-2">
                                Welcome back
                            </h1>
                            <p className="text-ink/70 mb-8">
                                Sign in to manage Revelation Camp participants.
                            </p>
                            <form className="space-y-6" onSubmit={handleLogin}>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="email-address" className="block text-sm font-semibold text-ink mb-1.5">Email</label>
                                        <input
                                            id="email-address"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="password" className="block text-sm font-semibold text-ink mb-1.5">Password</label>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div role="alert" className="rounded-lg border border-vermilion/40 bg-vermilion/5 p-4 text-sm text-oxblood">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-oxblood hover:bg-oxblood/90 text-parchment font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Signing in...' : 'Sign in'}
                                </button>
                            </form>
                            <p className="mt-8 text-center text-sm text-ink/60">
                                ¿Usas el celular?{' '}
                                <Link href="/instalar" className="font-semibold text-oxblood underline underline-offset-2">
                                    Instala la app
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Right Section - brand art: the stained-glass window from the Canva guide */}
                    <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-10 bg-oxblood p-12">
                        <Wordmark className="text-vermilion text-3xl" />
                        {/* black-on-white line art: invert + screen leaves only light lines on the oxblood panel */}
                        <Image
                            src="/brand/window-sun.png"
                            alt=""
                            width={580}
                            height={850}
                            priority
                            className="h-80 w-auto invert mix-blend-screen opacity-80"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
