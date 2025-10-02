'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#9bc3db' }}>
            <div className="max-w-6xl w-full">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
                    {/* Left Section - Login Form */}
                    <div className="w-full lg:w-1/2 p-8 lg:p-12 flex items-center">
                        <div className="w-full max-w-md mx-auto">
                            <div className="flex items-center mb-6 justify-center">
                                <Image
                                    src="/logos/vida_logo_black.PNG"
                                    alt="Vida Ministerio Juvenil Logo"
                                    width={240}
                                    height={160}
                                    priority
                                    className="h-40 w-60 object-contain"
                                />
                            </div>

                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                Welcome Back
                            </h2>
                            <p className="text-gray-600 mb-8">
                                Hey, welcome back to your camp management dashboard.
                            </p>
                            <form className="space-y-6" onSubmit={handleLogin}>
                                <div className="space-y-4">
                                    <div>
                                        <input
                                            id="email-address"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                                            placeholder="stanley@gmail.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                                        <div className="flex items-center">
                                            <svg className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="text-sm text-red-700">{error}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center mb-6">
                                    <label className="flex items-center">
                                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="ml-2 text-sm text-gray-600">Remember me</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Signing in...' : 'Sign In'}
                                </button>

                            </form>
                        </div>
                    </div>

                    {/* Right Section - Visual */}
                    <div className="w-full lg:w-1/2 p-4 flex items-center justify-center bg-white">
                        <div className="relative w-full">
                            <Image
                                src="/relevante-design.png"
                                alt="Relevante Camp Design"
                                width={960}
                                height={720}
                                className="w-full h-auto rounded-2xl border-4 border-white"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
