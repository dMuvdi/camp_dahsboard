'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getAllPeople, User } from '@/lib/supabase'

export default function DashboardPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filters, setFilters] = useState({
        p_email: '',
        p_gender: '',
        p_name: '',
        p_national_id: ''
    })
    const [searchTerm, setSearchTerm] = useState('')
    const router = useRouter()

    useEffect(() => {
        checkAuth()
        fetchUsers()
    }, [])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
        }
    }

    const fetchUsers = async (filterParams = {}) => {
        try {
            setLoading(true)
            const data = await getAllPeople(filterParams)
            setUsers(data)
        } catch (err) {
            setError('Failed to fetch users')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value }
        setFilters(newFilters)

        // Remove empty filters
        const cleanFilters = Object.fromEntries(
            Object.entries(newFilters).filter(([_, v]) => v !== '')
        )

        fetchUsers(cleanFilters)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filteredUsers = users.filter(user => {
        if (!searchTerm) return true
        const searchLower = searchTerm.toLowerCase()
        return (
            user.names.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            user.national_id.includes(searchTerm) ||
            user.phone_number.includes(searchTerm)
        )
    })

    const getSignedStatusColor = (user: User) => {
        if (user.has_signed) return 'bg-green-100 text-green-800'
        return 'bg-red-100 text-red-800'
    }

    const getSignedStatusText = (user: User) => {
        return user.has_signed ? 'Signed' : 'Not Signed'
    }

    const handleEmailUser = (user: User) => {
        // TODO: Implement email functionality
        console.log('Send email to:', user.email)
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
            {/* Header */}
            <header className="shadow-lg border-b" style={{ backgroundColor: '#9bc3db' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center space-x-4">
                                <img
                                    src="/logos/relevante_logo_white.PNG"
                                    alt="Vida Ministerio Juvenil Logo"
                                    className="h-30 w-30 object-contain"
                                />
                                <img
                                    src="/logos/vida_logo_white.PNG"
                                    alt="Vida Ministerio Juvenil Logo"
                                    className="h-30 w-30 object-contain"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleLogout}
                                className="bg-white hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-black">Camp Participants</h2>
                            <p className="text-black mt-1 font-medium">Manage and track your camp participants</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <img
                                src="/logos/relevante_logo_white.PNG"
                                alt="Relevante Camp Logo"
                                className="h-8 w-8 object-contain"
                            />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 mb-6">
                    <div className="flex items-center mb-4">
                        <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#9bc3db' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-800">Filter Participants</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by email"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm text-gray-900 placeholder-gray-500"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => e.target.style.borderColor = '#9bc3db'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                value={filters.p_email}
                                onChange={(e) => handleFilterChange('p_email', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Gender
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-xl bg-white shadow-sm text-gray-900 appearance-none"
                                    style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                    onFocus={(e) => e.target.style.borderColor = '#9bc3db'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    value={filters.p_gender}
                                    onChange={(e) => handleFilterChange('p_gender', e.target.value)}
                                >
                                    <option value="">All Genders</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by name"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm text-gray-900 placeholder-gray-500"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => e.target.style.borderColor = '#9bc3db'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                value={filters.p_name}
                                onChange={(e) => handleFilterChange('p_name', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                National ID
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by national ID"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm text-gray-900 placeholder-gray-500"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => e.target.style.borderColor = '#9bc3db'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                value={filters.p_national_id}
                                onChange={(e) => handleFilterChange('p_national_id', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4" style={{ borderColor: '#9bc3db' }}></div>
                            <p className="mt-4 text-gray-600 font-medium">Loading participants...</p>
                            <div className="mt-2 flex justify-center">
                                <div className="flex items-center space-x-2" style={{ color: '#9bc3db' }}>
                                    <span className="text-sm">Loading participants...</span>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <div className="inline-block bg-red-100 rounded-full p-3 mb-4">
                                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead style={{ backgroundColor: '#9bc3db' }}>
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            National ID
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Gender
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Checked In
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Checked Out
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Has Signed
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                            Email
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                                {user.national_id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0">
                                                        <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#9bc3db' }}>
                                                            <span className="text-white font-semibold text-sm">
                                                                {user.names.charAt(0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.names} {user.last_name_1} {user.last_name_2}
                                                        </div>
                                                        <div className="text-sm font-medium" style={{ color: '#9bc3db' }}>Age: {user.age}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {user.phone_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.gender === 'Masculino'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-pink-100 text-pink-800'
                                                    }`}>
                                                    {user.gender}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={user.checked_in}
                                                        readOnly
                                                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={user.checked_out}
                                                        readOnly
                                                        className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getSignedStatusColor(user)}`}>
                                                    {getSignedStatusText(user)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEmailUser(user)}
                                                    className="text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                                                    style={{ backgroundColor: '#9bc3db' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8bb3d1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9bc3db'}
                                                >
                                                    Email
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredUsers.length === 0 && (
                                <div className="p-12 text-center">
                                    <div className="inline-block bg-gray-100 rounded-full p-4 mb-4">
                                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No participants found</h3>
                                    <p className="text-gray-500">Try adjusting your search criteria or filters.</p>
                                    <div className="mt-4 flex justify-center">
                                        <div className="flex items-center space-x-2" style={{ color: '#9bc3db' }}>
                                            <span className="text-sm">No participants found</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
