'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl w-full">
                <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden flex flex-col lg:flex-row">
                    {/* Left Section - Login Form */}
                    <div className="w-full lg:w-1/2 p-8 lg:p-12 flex items-center">
                        <div className="w-full max-w-sm mx-auto">
                            <div className="flex items-center justify-between mb-10">
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
