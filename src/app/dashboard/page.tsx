'use client'

import Image from 'next/image'
import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo } from 'react'
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
        p_national_id: '',
        p_checked_in: '' as '' | 'true' | 'false',
        p_age_group: '' as '' | 'adults' | 'minors'
    })
    const [isModalOpen, setIsModalOpen] = useState(false)
    const initialFormState = {
        age: '',
        email: '',
        emergency_contact: '',
        emergency_contact_phone_number: '',
        gender: '',
        last_name_1: '',
        last_name_2: '',
        names: '',
        national_id: '',
        phone_number: ''
    }
    const [formData, setFormData] = useState(initialFormState)
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})
    const [formSubmitError, setFormSubmitError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [checkoutError, setCheckoutError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error' | 'loading', message: string } | null>(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [confirmUser, setConfirmUser] = useState<User | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [managerNames, setManagerNames] = useState<Record<string, string>>({})
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const router = useRouter()

    const checkAuth = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
        }
    }, [router])

    const fetchUsers = useCallback(async (
        filterParams: Record<string, string> = {},
        options: { silent?: boolean } = {}
    ) => {
        const { silent = false } = options
        try {
            if (silent) {
                setIsRefreshing(true)
            } else {
                setLoading(true)
            }
            // Separate non-RPC filters (like age group) from RPC filters
            const { p_age_group, ...rpcFilters } = filterParams as Record<string, string>
            const data = await getAllPeople(rpcFilters)
            const filteredByAge = Array.isArray(data) ? data.filter((u: User) => {
                if (!p_age_group) return true
                if (p_age_group === 'minors') return Number(u.age) < 18
                if (p_age_group === 'adults') return Number(u.age) >= 18
                return true
            }) : []

            const sortedUsers = Array.isArray(filteredByAge)
                ? [...filteredByAge].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                : []
            setUsers(sortedUsers)

            const managerIds = Array.isArray(filteredByAge)
                ? [...new Set(filteredByAge
                    .map((u: User) => u.manager_id)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0))]
                : []

            if (managerIds.length > 0) {
                const { data: managers, error: managersError } = await supabase
                    .from('People')
                    .select('id, names, last_name_1, last_name_2')
                    .in('id', managerIds)

                if (!managersError && Array.isArray(managers)) {
                    const mapping: Record<string, string> = {}
                    managers.forEach((manager) => {
                        mapping[manager.id as string] = `${manager.names ?? ''} ${manager.last_name_1 ?? ''} ${manager.last_name_2 ?? ''}`.trim()
                    })
                    setManagerNames(mapping)
                } else {
                    console.error('Failed to fetch managers', managersError)
                    setManagerNames({})
                }
            } else {
                setManagerNames({})
            }
        } catch (err) {
            setError('Failed to fetch users')
            console.error(err)
        } finally {
            if (silent) {
                setIsRefreshing(false)
            } else {
                setLoading(false)
            }
        }
    }, [])

    useEffect(() => {
        checkAuth()
        fetchUsers({}, { silent: false })
    }, [checkAuth, fetchUsers])

    const getActiveFilters = useCallback((filterValues = filters) => {
        return Object.fromEntries(
            Object.entries(filterValues).filter(([, v]) => v !== '')
        )
    }, [filters])

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value }
        setFilters(newFilters)

        // Remove empty filters
        fetchUsers(getActiveFilters(newFilters), { silent: true })
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filteredUsers = useMemo(() => users, [users])

    const getSignedStatusColor = (user: User) => {
        if (user.has_signed) return 'bg-green-100 text-green-800'
        return 'bg-red-100 text-red-800'
    }

    const getSignedStatusText = (user: User) => {
        return user.has_signed ? 'Signed' : 'Not Signed'
    }

    const sendEmailTo = async (user: User) => {
        try {
            // Show loading state
            setEmailStatus({ type: 'loading', message: 'Sending Email...' })

            // Determine the correct URL based on age
            const isMinor = Number(user.age) < 18;
            const signingUrl = `https://camp-dahsboard.vercel.app/contract_sign/${user.id}`;

            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: user.email,
                    subject: 'Firma de Consentimiento - Relevante Camp',
                    text: `Hola ${user.names}! Este es el link para firmar tu consentimiento: ${signingUrl}`,
                    userId: user.id,
                    fullName: `${user.names} ${user.last_name_1} ${user.last_name_2}`.trim(),
                    emailType: 'contract',
                    contractUrl: signingUrl
                })
            })
            if (!res.ok) {
                console.error('Email failed')
                setEmailStatus({ type: 'error', message: 'Oops! Failed to send email. Please try again.' })
                setTimeout(() => setEmailStatus(null), 5000)
            }
            else {
                setEmailStatus({ type: 'success', message: `🎉 Email sent to ${user.names}!` })
                setTimeout(() => setEmailStatus(null), 5000)
            }
        } catch (e) {
            console.error('Email error', e)
            setEmailStatus({ type: 'error', message: 'Oops! Something went wrong. Please try again.' })
            setTimeout(() => setEmailStatus(null), 5000)
        }
    }

    const handleEmailUser = (user: User) => {
        setConfirmUser(user)
        setIsConfirmOpen(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleCheckInUpdate = async (user: User, isCheckedIn: boolean) => {
        try {
            const { data, error } = await supabase.rpc('update_person', {
                p_age: user.age,
                p_checked_in: isCheckedIn,
                p_checked_out: user.checked_out,
                p_email: user.email,
                p_emergency_contact: user.emergency_contact,
                p_emergency_contact_phone_number: user.emergency_contact_phone_number,
                p_has_signed: user.has_signed,
                p_id: user.id,
                p_last_name_1: user.last_name_1,
                p_last_name_2: user.last_name_2,
                p_names: user.names,
                p_national_id: user.national_id,
                p_phone_number: user.phone_number
            })

            if (error) {
                console.error(error)
                // Revert the local state change by refetching data
                await fetchUsers(getActiveFilters(), { silent: true })
            } else {
                console.log(data)
                // Update local state
                setUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, checked_in: isCheckedIn } : u
                ))
            }
        } catch (err) {
            console.error('Error updating check-in status:', err)
            // Revert the local state change by refetching data
            await fetchUsers(getActiveFilters(), { silent: true })
        }
    }

    const handleCheckOutUpdate = async (user: User, isCheckedOut: boolean) => {
        // Clear any previous checkout error
        setCheckoutError(null)

        // Validation: Cannot check out if not checked in
        if (isCheckedOut && !user.checked_in) {
            setCheckoutError(`Cannot check out ${user.names} ${user.last_name_1} - they are not checked in yet.`)
            return
        }

        try {
            const { data, error } = await supabase.rpc('update_person', {
                p_age: user.age,
                p_checked_in: user.checked_in,
                p_checked_out: isCheckedOut,
                p_email: user.email,
                p_emergency_contact: user.emergency_contact,
                p_emergency_contact_phone_number: user.emergency_contact_phone_number,
                p_has_signed: user.has_signed,
                p_id: user.id,
                p_last_name_1: user.last_name_1,
                p_last_name_2: user.last_name_2,
                p_names: user.names,
                p_national_id: user.national_id,
                p_phone_number: user.phone_number
            })

            if (error) {
                console.error(error)
                // Revert the local state change by refetching data
                await fetchUsers(getActiveFilters())
            } else {
                console.log(data)
                // Update local state
                setUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, checked_out: isCheckedOut } : u
                ))
            }
        } catch (err) {
            console.error('Error updating check-out status:', err)
            // Revert the local state change by refetching data
            await fetchUsers(getActiveFilters())
        }
    }

    const handleInputChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (formErrors[name]) {
            setFormErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const validateForm = () => {
        const errors: Record<string, string> = {}

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const phoneRegex = /^\+?\d{7,15}$/

        if (!formData.names.trim()) {
            errors.names = 'Names are required'
        }

        if (!formData.last_name_1.trim()) {
            errors.last_name_1 = 'First last name is required'
        }

        if (!formData.last_name_2.trim()) {
            errors.last_name_2 = 'Second last name is required'
        }

        if (!formData.age || Number.isNaN(Number(formData.age))) {
            errors.age = 'Age is required'
        } else if (Number(formData.age) <= 0) {
            errors.age = 'Age must be a positive number'
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required'
        } else if (!emailRegex.test(formData.email.trim())) {
            errors.email = 'Enter a valid email address'
        }

        if (!formData.phone_number.trim()) {
            errors.phone_number = 'Phone number is required'
        } else if (!phoneRegex.test(formData.phone_number.trim())) {
            errors.phone_number = 'Enter a valid phone number'
        }

        if (!formData.gender) {
            errors.gender = 'Gender is required'
        }

        if (!formData.national_id.trim()) {
            errors.national_id = 'National ID is required'
        }

        if (formData.emergency_contact.trim() && !formData.emergency_contact.includes(' - ')) {
            errors.emergency_contact = 'Use the format "Name - Relationship"'
        }

        if (formData.emergency_contact_phone_number.trim() && !phoneRegex.test(formData.emergency_contact_phone_number.trim())) {
            errors.emergency_contact_phone_number = 'Enter a valid phone number'
        }

        setFormErrors(errors)
        return errors
    }

    const resetForm = () => {
        setFormData(initialFormState)
        setFormErrors({})
        setFormSubmitError('')
    }

    const closeModal = () => {
        setIsModalOpen(false)
        resetForm()
        setFormSubmitError('')
        setIsSubmitting(false)
        setIsDeleting(false)
        setIsDeleteConfirmOpen(false)
        setIsEditing(false)
        setEditingUser(null)
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (isSubmitting) return

        const errors = validateForm()
        if (Object.keys(errors).length > 0) {
            return
        }

        setIsSubmitting(true)
        setFormSubmitError('')

        if (isEditing && editingUser) {
            // Update existing person
            const updatePayload = {
                p_age: Number(formData.age),
                p_checked_in: editingUser.checked_in,
                p_checked_out: editingUser.checked_out,
                p_email: formData.email.trim(),
                p_emergency_contact: formData.emergency_contact.trim() || '',
                p_emergency_contact_phone_number: formData.emergency_contact_phone_number.trim() || '',
                p_has_signed: editingUser.has_signed,
                p_id: editingUser.id,
                p_last_name_1: formData.last_name_1.trim(),
                p_last_name_2: formData.last_name_2.trim(),
                p_names: formData.names.trim(),
                p_national_id: formData.national_id.trim(),
                p_phone_number: formData.phone_number.trim()
            }

            try {
                const { data, error } = await supabase.rpc('update_person', updatePayload)
                if (error) {
                    console.error(error)
                    setFormSubmitError('Failed to update participant. Please try again.')
                } else {
                    console.log(data)
                    await fetchUsers(getActiveFilters(), { silent: true })
                    closeModal()
                }
            } catch (err) {
                console.error(err)
                setFormSubmitError('Unexpected error. Please try again.')
            } finally {
                setIsSubmitting(false)
            }
        } else {
            // Add new person
            const payload = {
                p_age: Number(formData.age),
                p_email: formData.email.trim(),
                p_emergency_contact: formData.emergency_contact.trim() || '',
                p_emergency_contact_phone_number: formData.emergency_contact_phone_number.trim() || '',
                p_gender: formData.gender,
                p_last_name_1: formData.last_name_1.trim(),
                p_last_name_2: formData.last_name_2.trim(),
                p_names: formData.names.trim(),
                p_national_id: formData.national_id.trim(),
                p_phone_number: formData.phone_number.trim()
            }

            try {
                const { data, error } = await supabase.rpc('add_person', payload)
                if (error) {
                    console.error(error)
                    setFormSubmitError('Failed to add participant. Please try again.')
                } else {
                    console.log(data)
                    await fetchUsers(getActiveFilters())
                    closeModal()
                }
            } catch (err) {
                console.error(err)
                setFormSubmitError('Unexpected error. Please try again.')
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    const handleDeleteParticipant = async () => {
        if (!editingUser) return

        setIsDeleting(true)
        setFormSubmitError('')
        try {
            const { error } = await supabase
                .from('People')
                .delete()
                .eq('id', editingUser.id)

            if (error) {
                console.error('Delete participant error', error)
                setFormSubmitError('No se pudo eliminar al participante. Intenta nuevamente.')
                setIsDeleting(false)
                return
            }

            await fetchUsers(getActiveFilters(), { silent: true })
            setIsDeleteConfirmOpen(false)
            closeModal()
        } catch (err) {
            console.error('Unexpected delete error', err)
            setFormSubmitError('Ocurrió un error inesperado al eliminar al participante.')
            setIsDeleting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="shadow-xl border-b-2 border-opacity-20" style={{ backgroundColor: '#9bc3db', borderBottomColor: '#8bb3d1' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-24">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center space-x-6">
                                <Image
                                    width={240}
                                    height={160}
                                    src="/logos/relevante_logo_white.PNG"
                                    alt="Relevante Logo"
                                    className="w-20 md:w-30 h-30 object-contain transform hover:scale-105 transition-transform duration-300"
                                />
                                <Image
                                    width={240}
                                    height={160}
                                    src="/logos/vida_logo_white.PNG"
                                    alt="Vida Ministerio Juvenil Logo"
                                    className="w-20 md:w-30 h-30 object-contain transform hover:scale-105 transition-transform duration-300"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleLogout}
                                className="bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 px-6 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {isConfirmOpen && confirmUser && (
                    <div className="fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsConfirmOpen(false)}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
                                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#f8fafc' }}>
                                    <h3 className="text-lg font-bold text-gray-900">Send confirmation email</h3>
                                    <button onClick={() => setIsConfirmOpen(false)} className="text-gray-500 hover:text-gray-700">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-3">
                                    <p className="text-sm text-gray-700">Are you sure you want to send the confirmation email to:</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#9bc3db' }}>
                                            <span className="text-white font-bold">{confirmUser.names.charAt(0)}</span>
                                        </div>
                                        <div className="text-sm">
                                            <div className="font-bold text-gray-900">{confirmUser.names} {confirmUser.last_name_1} {confirmUser.last_name_2}</div>
                                            <div className="text-gray-600">{confirmUser.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                                    <button onClick={() => setIsConfirmOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const userCopy = confirmUser as User
                                            setIsConfirmOpen(false)
                                            setConfirmUser(null)
                                            // Defer sending to next tick to ensure modal unmounts first
                                            setTimeout(() => { void sendEmailTo(userCopy) }, 0)
                                        }}
                                        className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition"
                                        style={{ backgroundColor: '#9bc3db' }}
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {isDeleteConfirmOpen && editingUser && (
                    <div className="fixed inset-0 z-[60]">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isDeleting) setIsDeleteConfirmOpen(false) }}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-red-100 overflow-hidden">
                                <div className="px-6 py-5 border-b border-red-100 flex items-center justify-between" style={{ backgroundColor: '#fef2f2' }}>
                                    <h3 className="text-lg font-bold text-red-700">Eliminar participante</h3>
                                    <button onClick={() => { if (!isDeleting) setIsDeleteConfirmOpen(false) }} className="text-red-500 hover:text-red-700">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    <p className="text-sm text-gray-700">¿Estás seguro de que deseas eliminar a:</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
                                            <span className="text-red-600 font-bold">{editingUser.names.charAt(0)}</span>
                                        </div>
                                        <div className="text-sm">
                                            <div className="font-bold text-gray-900">{editingUser.names} {editingUser.last_name_1} {editingUser.last_name_2}</div>
                                            <div className="text-gray-600">C.C. {editingUser.national_id}</div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                                        Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a este participante.
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-red-100 bg-white flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { if (!isDeleting) setIsDeleteConfirmOpen(false) }}
                                        className="px-5 py-2 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                                        disabled={isDeleting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { void handleDeleteParticipant() }}
                                        className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        style={{ backgroundColor: '#ef4444' }}
                                        onMouseEnter={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = '#dc2626')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Eliminando...' : 'Eliminar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* Page Header */}
                <div className="mb-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-4">
                        <div className="space-y-2 text-center md:text-left">
                            <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Camp Participants</h2>
                            <p className="text-lg text-gray-600 font-medium">Manage and track your camp participants</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-center md:justify-end gap-4">
                            <button
                                onClick={() => { void fetchUsers(getActiveFilters(), { silent: false }); }}
                                className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex items-center space-x-2"
                                style={{ backgroundColor: '#1d5c81' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#174965')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1d5c81')}
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M20 20v-5h-.581m-15.357-2a8.003 8.003 0 0015.357 2" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex items-center space-x-2"
                                style={{ backgroundColor: '#9bc3db' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8bb3d1')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#9bc3db')}
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Add Participant</span>
                            </button>
                            <a
                                href="/scan-qr"
                                className="md:hidden px-8 py-3.5 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex items-center space-x-2"
                                style={{ backgroundColor: '#6366f1' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6366f1')}
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Scan QR</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 p-8 mb-8 backdrop-blur-sm">
                    <div className="flex items-center mb-6">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mr-4 shadow-lg" style={{ backgroundColor: '#f0f8ff' }}>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#9bc3db' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Filter Participants</h3>
                        <div className="ml-auto">
                            <button
                                onClick={() => {
                                    const reset = { p_email: '', p_gender: '', p_name: '', p_national_id: '', p_checked_in: '' as '' | 'true' | 'false', p_age_group: '' as '' | 'adults' | 'minors' }
                                    setFilters(reset)
                                    fetchUsers({}, { silent: true })
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300"
                                style={{ backgroundColor: '#ef4444' }}
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0V5a2 2 0 012-2h3a2 2 0 012 2v2" />
                                </svg>
                                Remove filters
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                Email
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by email"
                                className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#9bc3db'
                                    e.target.style.boxShadow = '0 0 0 3px rgba(155, 195, 219, 0.1)'
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb'
                                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                value={filters.p_email}
                                onChange={(e) => handleFilterChange('p_email', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                Gender
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-4 pr-12 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 appearance-none transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                    style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#9bc3db'
                                        e.target.style.boxShadow = '0 0 0 3px rgba(155, 195, 219, 0.1)'
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e5e7eb'
                                        e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    value={filters.p_gender}
                                    onChange={(e) => handleFilterChange('p_gender', e.target.value)}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                Name
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by name"
                                className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#9bc3db'
                                    e.target.style.boxShadow = '0 0 0 3px rgba(155, 195, 219, 0.1)'
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb'
                                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                value={filters.p_name}
                                onChange={(e) => handleFilterChange('p_name', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                National ID
                            </label>
                            <input
                                type="text"
                                placeholder="Filter by national ID"
                                className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#9bc3db'
                                    e.target.style.boxShadow = '0 0 0 3px rgba(155, 195, 219, 0.1)'
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb'
                                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                value={filters.p_national_id}
                                onChange={(e) => handleFilterChange('p_national_id', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                Checked In
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-4 pr-12 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 appearance-none transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                    value={filters.p_checked_in}
                                    onChange={(e) => handleFilterChange('p_checked_in', e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="true">Checked In</option>
                                    <option value="false">Not Checked In</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-800 mb-3">
                                Age
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-4 pr-12 border-2 border-gray-200 rounded-2xl bg-white shadow-md text-gray-900 appearance-none transition-all duration-300 focus:border-2 focus:shadow-lg focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                    value={filters.p_age_group}
                                    onChange={(e) => handleFilterChange('p_age_group', e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="minors">Minors (&lt; 18)</option>
                                    <option value="adults">Adults (≥ 18)</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden backdrop-blur-sm relative">
                    {emailStatus && (
                        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl border-2 transform transition-all duration-300 ease-out ${emailStatus.type === 'success'
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-800'
                            : emailStatus.type === 'error'
                                ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300 text-red-800'
                                : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-800'
                            } animate-[slideInRight_0.3s_ease-out]`}>
                            <div className="flex items-center gap-3">
                                {emailStatus.type === 'success' ? (
                                    <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-[scaleIn_0.4s_ease-out]">
                                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : emailStatus.type === 'error' ? (
                                    <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-[shake_0.4s_ease-out]">
                                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="h-6 w-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-base font-bold leading-tight">{emailStatus.message}</span>
                                    {emailStatus.type === 'loading' && (
                                        <span className="text-xs font-semibold opacity-70 mt-0.5">Please wait...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {isRefreshing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-8 w-8 border-2 border-[#9bc3db] border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm font-semibold text-slate-600">Updating participants...</span>
                            </div>
                        </div>
                    )}
                    {checkoutError && (
                        <div className="mx-8 mt-6 rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-semibold">{checkoutError}</span>
                                </div>
                                <button
                                    onClick={() => setCheckoutError(null)}
                                    className="text-red-500 hover:text-red-700 transition-colors duration-200"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-4" style={{ borderTopColor: '#9bc3db' }}></div>
                            <p className="mt-6 text-gray-700 font-semibold text-lg">Loading participants...</p>
                            <div className="mt-3 flex justify-center">
                                <div className="flex items-center space-x-2 px-4 py-2 rounded-full" style={{ backgroundColor: '#f0f8ff', color: '#9bc3db' }}>
                                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#9bc3db' }}></div>
                                    <span className="text-sm font-medium">Please wait...</span>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <div className="inline-block bg-red-100 rounded-3xl p-6 mb-6 shadow-lg">
                                <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-red-600 font-bold text-lg">{error}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="rounded-t-2xl" style={{ backgroundColor: '#9bc3db' }}>
                                    <tr>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            National ID
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Gender
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Checked In
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Checked Out
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Has Signed
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Manager
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Action
                                        </th>
                                        <th className="px-8 py-6 text-left text-xs font-bold text-white uppercase tracking-wider">
                                            Document
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {filteredUsers.map((user: User) => (
                                        <tr key={user.id} onClick={() => {
                                            setIsEditing(true)
                                            setEditingUser(user)
                                            setFormData({
                                                age: String(user.age ?? ''),
                                                email: user.email ?? '',
                                                emergency_contact: user.emergency_contact ?? '',
                                                emergency_contact_phone_number: user.emergency_contact_phone_number ?? '',
                                                gender: user.gender ?? '',
                                                last_name_1: user.last_name_1 ?? '',
                                                last_name_2: user.last_name_2 ?? '',
                                                names: user.names ?? '',
                                                national_id: user.national_id ?? '',
                                                phone_number: user.phone_number ?? ''
                                            })
                                            setIsModalOpen(true)
                                        }} className={`cursor-pointer transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md ${user.checked_in
                                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 hover:from-green-100 hover:to-emerald-100'
                                            : 'bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-400 hover:from-red-100 hover:to-rose-100'
                                            }`}>
                                            <td className="px-8 py-6 whitespace-nowrap text-sm font-mono font-semibold">
                                                <span className={user.checked_in ? 'text-green-800' : 'text-red-800'}>
                                                    {user.national_id}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-12 w-12 flex-shrink-0">
                                                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-200 hover:scale-110" style={{ backgroundColor: '#9bc3db' }}>
                                                            <span className="text-white font-bold text-base">
                                                                {user.names.charAt(0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-5">
                                                        <div className={`text-sm font-bold ${user.checked_in ? 'text-green-800' : 'text-red-800'}`}>
                                                            {user.names} {user.last_name_1} {user.last_name_2}
                                                        </div>
                                                        <div className={`text-sm font-semibold px-2 py-1 rounded-lg mt-1 ${user.checked_in
                                                            ? 'text-green-700 bg-green-100'
                                                            : 'text-red-700 bg-red-100'
                                                            }`}>Age: {user.age}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-8 py-6 whitespace-nowrap text-sm font-medium ${user.checked_in ? 'text-green-800' : 'text-red-800'}`}>
                                                {user.email}
                                            </td>
                                            <td className={`px-8 py-6 whitespace-nowrap text-sm font-medium ${user.checked_in ? 'text-green-800' : 'text-red-800'}`}>
                                                {user.phone_number}
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-sm text-gray-900">
                                                <span className={`inline-flex px-4 py-2 text-xs font-bold rounded-2xl shadow-md ${user.gender === 'Masculino'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-pink-100 text-pink-800'
                                                    }`}>
                                                    {user.gender}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center">
                                                    <div className={`relative inline-flex items-center justify-center w-7 h-7 rounded-lg shadow-lg transition-all duration-300 ${user.checked_in
                                                        ? 'bg-gradient-to-br from-green-400 to-green-600 border-2 border-green-500'
                                                        : 'bg-white border-2 border-gray-300'
                                                        }`}>
                                                        {user.checked_in && (
                                                            <svg className="w-4 h-4 text-white font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={user.checked_out}
                                                        onChange={(e) => handleCheckOutUpdate(user, e.target.checked)}
                                                        disabled={!user.checked_in}
                                                        className={`h-6 w-6 border-2 border-gray-300 rounded-lg shadow-sm transition-all duration-200 ${!user.checked_in
                                                            ? 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-50'
                                                            : 'text-green-600 focus:ring-green-500 cursor-pointer hover:scale-110'
                                                            }`}
                                                        title={!user.checked_in ? "Cannot check out - not checked in yet" : "Click to check out"}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className={`inline-flex px-4 py-2 text-xs font-bold rounded-2xl shadow-md ${getSignedStatusColor(user)}`}>
                                                    {getSignedStatusText(user)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-sm font-medium text-gray-600">
                                                {user.manager_id
                                                    ? (managerNames[user.manager_id] || 'Cargando...')
                                                    : '—'}
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-sm font-medium text-gray-600">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleEmailUser(user)}
                                                    className="text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
                                                    style={{ backgroundColor: '#9bc3db' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8bb3d1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9bc3db'}
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Email</span>
                                                </button>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => { if (user.document_url) window.open(user.document_url, '_blank', 'noopener,noreferrer') }}
                                                    disabled={!user.document_url}
                                                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all duration-300 shadow ${user.document_url ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 hover:shadow-md' : 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'}`}
                                                    title={user.document_url ? 'Open document' : 'No document available'}
                                                >
                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7v10a2 2 0 002 2h6a2 2 0 002-2V9.414a2 2 0 00-.586-1.414l-2.414-2.414A2 2 0 0012.586 5H9a2 2 0 00-2 2z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredUsers.length === 0 && (
                                <div className="p-16 text-center">
                                    <div className="inline-block bg-gray-100 rounded-3xl p-8 mb-6 shadow-lg">
                                        <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-700 mb-3">No participants found</h3>
                                    <p className="text-gray-500 text-lg mb-6">Try adjusting your search criteria or filters.</p>
                                    <div className="flex justify-center">
                                        <div className="flex items-center space-x-3 px-6 py-3 rounded-2xl shadow-lg" style={{ backgroundColor: '#f0f8ff', color: '#9bc3db' }}>
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            <span className="text-sm font-semibold">No results to display</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6 lg:px-8 backdrop-blur-sm overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
                    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden transform transition-all duration-300 scale-100 my-8">
                        <div className="flex items-center justify-between px-8 py-6 border-b-2 border-gray-100 sticky top-0 bg-white z-10" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#9bc3db' }}>
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900">Add New Participant</h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-gray-500 hover:text-gray-700 transition-all duration-200 p-2 rounded-2xl hover:bg-gray-100 transform hover:scale-110"
                                aria-label="Close"
                            >
                                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                            <form onSubmit={handleSubmit} className="px-8 py-8 space-y-8">
                                {formSubmitError && (
                                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-lg">
                                        <div className="flex items-center space-x-3">
                                            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="font-semibold">{formSubmitError}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="names">
                                            Names *
                                        </label>
                                        <input
                                            id="names"
                                            name="names"
                                            type="text"
                                            value={formData.names}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.names && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.names}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="age">
                                            Age *
                                        </label>
                                        <input
                                            id="age"
                                            name="age"
                                            type="number"
                                            min={1}
                                            value={formData.age}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.age && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.age}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="last_name_1">
                                            First Last Name *
                                        </label>
                                        <input
                                            id="last_name_1"
                                            name="last_name_1"
                                            type="text"
                                            value={formData.last_name_1}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.last_name_1 && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.last_name_1}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="last_name_2">
                                            Second Last Name *
                                        </label>
                                        <input
                                            id="last_name_2"
                                            name="last_name_2"
                                            type="text"
                                            value={formData.last_name_2}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.last_name_2 && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.last_name_2}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="email">
                                            Email *
                                        </label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.email && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.email}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="phone_number">
                                            Phone Number *
                                        </label>
                                        <input
                                            id="phone_number"
                                            name="phone_number"
                                            type="tel"
                                            value={formData.phone_number}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.phone_number && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.phone_number}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="gender">
                                            Gender *
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="gender"
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-5 py-4 pr-14 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 appearance-none transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                                style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#9bc3db'
                                                    e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = '#e5e7eb'
                                                    e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                }}
                                            >
                                                <option value="">Select gender</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {formErrors.gender && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.gender}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-900 mb-3" htmlFor="national_id">
                                            National ID *
                                        </label>
                                        <input
                                            id="national_id"
                                            name="national_id"
                                            type="text"
                                            value={formData.national_id}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.national_id && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.national_id}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-3" htmlFor="emergency_contact">
                                            Emergency Contact
                                        </label>
                                        <input
                                            id="emergency_contact"
                                            name="emergency_contact"
                                            type="text"
                                            placeholder="Name - Relationship"
                                            value={formData.emergency_contact}
                                            onChange={handleInputChange}
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.emergency_contact && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.emergency_contact}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-3" htmlFor="emergency_contact_phone_number">
                                            Emergency Contact Phone
                                        </label>
                                        <input
                                            id="emergency_contact_phone_number"
                                            name="emergency_contact_phone_number"
                                            type="tel"
                                            value={formData.emergency_contact_phone_number}
                                            onChange={handleInputChange}
                                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl bg-white shadow-lg text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-2 focus:shadow-xl focus:ring-0 focus:outline-none transform focus:scale-[1.02]"
                                            style={{ '--tw-ring-color': '#9bc3db', '--tw-border-color': '#9bc3db' } as React.CSSProperties}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#9bc3db'
                                                e.target.style.boxShadow = '0 0 0 4px rgba(155, 195, 219, 0.15)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb'
                                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                            }}
                                        />
                                        {formErrors.emergency_contact_phone_number && (
                                            <p className="mt-2 text-sm text-red-600 font-semibold">{formErrors.emergency_contact_phone_number}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 pt-6 border-t-2 border-gray-100 sticky bottom-0 bg-white z-10">
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            disabled={isSubmitting || isDeleting}
                                            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-2xl"
                                            style={{ backgroundColor: '#ef4444' }}
                                            onMouseEnter={(e) => !isSubmitting && !isDeleting && (e.currentTarget.style.backgroundColor = '#dc2626')}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
                                        >
                                            {isDeleting ? 'Eliminando...' : 'Eliminar participante'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || isDeleting}
                                        className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-2"
                                        style={{ backgroundColor: '#9bc3db' }}
                                        onMouseEnter={(e) => !isSubmitting && !isDeleting && (e.currentTarget.style.backgroundColor = '#8bb3d1')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#9bc3db')}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Save Participant</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
