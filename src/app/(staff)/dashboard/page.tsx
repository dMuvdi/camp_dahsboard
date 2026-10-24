'use client'

import Image from 'next/image'
import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getAllPeople, User } from '@/lib/supabase'
import Wordmark from '@/components/Wordmark'
import PushToggle from '@/components/PushToggle'
import StaffNav from '@/components/StaffNav'
import InstallHint from '@/components/InstallHint'
import { camp } from '@/lib/camp'

interface DashboardStats {
    total: number
    signed: number
    notSigned: number
    checkedIn: number
    notCheckedIn: number
    checkedOut: number
    notCheckedOut: number
}

// Shared class strings for the participants list
const primaryBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-oxblood px-4 text-sm font-semibold text-parchment transition-colors hover:bg-oxblood/90'
const secondaryBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/5'
const iconBtn = 'inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-md text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
const badge = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap'
const toolbarField = 'h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder-ink/40 focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/25'

function StatCard({ label, value, total, bar }: { label: string; value: number; total: number; bar: string }) {
    const pct = total ? Math.round((value / total) * 100) : 0
    return (
        <div className="rounded-[20px] bg-white p-4 shadow-card md:p-5">
            <p className="text-sm text-ink/60">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                {value}<span className="text-base font-semibold text-ink/35"> / {total}</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

export default function DashboardPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [stats, setStats] = useState<DashboardStats>({
        total: 0,
        signed: 0,
        notSigned: 0,
        checkedIn: 0,
        notCheckedIn: 0,
        checkedOut: 0,
        notCheckedOut: 0
    })
    const [filters, setFilters] = useState({
        p_email: '',
        p_gender: '',
        p_name: '',
        p_national_id: '',
        p_checked_in: '' as '' | 'true' | 'false',
        p_age_group: '' as '' | 'adults' | 'minors',
        p_has_signed: '' as '' | 'true' | 'false',
        p_checked_out: '' as '' | 'true' | 'false'
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
    const [isQRConfirmOpen, setIsQRConfirmOpen] = useState(false)
    const [confirmQRUser, setConfirmQRUser] = useState<User | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [copyStatus, setCopyStatus] = useState<string | null>(null)
    const [isCopyToastVisible, setIsCopyToastVisible] = useState(false)
    const copyHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const copyRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [managerNames, setManagerNames] = useState<Record<string, string>>({})
    const router = useRouter()

    const checkAuth = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
        }
    }, [router])

    const fetchStats = useCallback(async () => {
        try {
            // Fetch all people to calculate stats
            const { data, error } = await supabase
                .from('People')
                .select('has_signed, checked_in, checked_out')

            if (error) {
                console.error('Error fetching stats:', error)
                return
            }

            if (data) {
                const total = data.length
                const signed = data.filter(p => p.has_signed).length
                const notSigned = total - signed
                const checkedIn = data.filter(p => p.checked_in).length
                const notCheckedIn = total - checkedIn
                const checkedOut = data.filter(p => p.checked_out).length
                const notCheckedOut = total - checkedOut

                setStats({
                    total,
                    signed,
                    notSigned,
                    checkedIn,
                    notCheckedIn,
                    checkedOut,
                    notCheckedOut
                })
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }, [])

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
            const { p_age_group: pAgeGroup, p_has_signed: pHasSigned, p_checked_in: pCheckedIn, p_checked_out: pCheckedOut, ...rpcFilters } = filterParams as Record<string, string>
            const data = await getAllPeople(rpcFilters)
            const filteredByAge = Array.isArray(data) ? data.filter((u: User) => {
                if (!pAgeGroup) return true
                if (pAgeGroup === 'minors') return Number(u.age) < 18
                if (pAgeGroup === 'adults') return Number(u.age) >= 18
                return true
            }) : []

            const filteredBySigned = Array.isArray(filteredByAge) ? filteredByAge.filter((u: User) => {
                if (!pHasSigned) return true
                return pHasSigned === 'true' ? !!u.has_signed : !u.has_signed
            }) : []

            const filteredByCheckIn = Array.isArray(filteredBySigned) ? filteredBySigned.filter((u: User) => {
                if (!pCheckedIn) return true
                return pCheckedIn === 'true' ? !!u.checked_in : !u.checked_in
            }) : []

            const filteredByCheckOut = Array.isArray(filteredByCheckIn) ? filteredByCheckIn.filter((u: User) => {
                if (!pCheckedOut) return true
                return pCheckedOut === 'true' ? !!u.checked_out : !u.checked_out
            }) : []

            const sortedUsers = Array.isArray(filteredByCheckOut)
                ? [...filteredByCheckOut].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                : []
            setUsers(sortedUsers)

            const managerIds = Array.isArray(filteredByCheckOut)
                ? [...new Set(filteredByCheckOut
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

            // Fetch stats after fetching users
            await fetchStats()
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
    }, [fetchStats])

    useEffect(() => {
        return () => {
            if (copyHideTimerRef.current) {
                clearTimeout(copyHideTimerRef.current)
            }
            if (copyRemoveTimerRef.current) {
                clearTimeout(copyRemoveTimerRef.current)
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

    const handleQuickSearch = (value: string) => {
        const isId = /^\d+$/.test(value.trim())
        const newFilters = { ...filters, p_name: isId ? '' : value, p_national_id: isId ? value.trim() : '' }
        setFilters(newFilters)
        fetchUsers(getActiveFilters(newFilters), { silent: true })
    }

    const openAdd = () => {
        setIsEditing(false)
        setEditingUser(null)
        setIsModalOpen(true)
    }

    // The tab bar's Add button on other screens links here with ?add=1
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('add') === '1') {
            setIsModalOpen(true)
            window.history.replaceState(null, '', '/dashboard')
        }
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filteredUsers = useMemo(() => users, [users])

    // Status tabs: one status filter at a time; counts are camp-wide (fetchStats)
    const noStatus = { p_has_signed: '', p_checked_in: '', p_checked_out: '' } as const
    const statusTabs = [
        { label: 'All', count: stats.total, dot: '', patch: {} },
        { label: 'Signed', count: stats.signed, dot: 'bg-glass', patch: { p_has_signed: 'true' } },
        { label: 'Not signed', count: stats.notSigned, dot: 'bg-vermilion', patch: { p_has_signed: 'false' } },
        { label: 'Checked in', count: stats.checkedIn, dot: 'bg-glass', patch: { p_checked_in: 'true' } },
        { label: 'Not checked in', count: stats.notCheckedIn, dot: 'bg-ink/30', patch: { p_checked_in: 'false' } },
        { label: 'Checked out', count: stats.checkedOut, dot: 'bg-ink', patch: { p_checked_out: 'true' } },
    ] as const

    const isTabActive = (patch: Partial<typeof filters>) =>
        (Object.keys(noStatus) as (keyof typeof noStatus)[]).every((k) => filters[k] === (patch[k] ?? ''))

    const handleStatusTab = (patch: Partial<typeof filters>) => {
        const newFilters = { ...filters, ...noStatus, ...patch }
        setFilters(newFilters)
        fetchUsers(getActiveFilters(newFilters), { silent: true })
    }

    const clearFilters = () => {
        setFilters({ p_email: '', p_gender: '', p_name: '', p_national_id: '', p_age_group: '', ...noStatus })
        fetchUsers({}, { silent: true })
    }

    // The email route only accepts signed-in staff; it looks up the recipient itself
    const sendStaffEmail = async (userId: string, emailType: 'contract' | 'ticket') => {
        const { data: { session } } = await supabase.auth.getSession()
        return fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
            body: JSON.stringify({ userId, emailType }),
        })
    }

    const sendEmailTo = async (user: User) => {
        try {
            // Show loading state
            setEmailStatus({ type: 'loading', message: 'Sending Email...' })

            const res = await sendStaffEmail(user.id, 'contract')
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

    const sendQRCodeEmail = async (user: User) => {
        try {
            // Show loading state
            setEmailStatus({ type: 'loading', message: 'Sending QR Code Email...' })

            const res = await sendStaffEmail(user.id, 'ticket')
            if (!res.ok) {
                console.error('QR Code email failed')
                setEmailStatus({ type: 'error', message: 'No se pudo enviar el código QR. Intenta nuevamente.' })
                setTimeout(() => setEmailStatus(null), 5000)
            }
            else {
                setEmailStatus({ type: 'success', message: `🎉 Código QR enviado a ${user.names}!` })
                setTimeout(() => setEmailStatus(null), 5000)
            }
        } catch (e) {
            console.error('QR Code email error', e)
            setEmailStatus({ type: 'error', message: 'Ocurrió un error. Intenta nuevamente.' })
            setTimeout(() => setEmailStatus(null), 5000)
        }
    }

    const handleCopySignatureLink = async (user: User) => {
        const link = `${window.location.origin}/contract_sign/${user.id}`
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(link)
            } else {
                const textarea = document.createElement('textarea')
                textarea.value = link
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }

            if (copyHideTimerRef.current) {
                clearTimeout(copyHideTimerRef.current)
            }
            if (copyRemoveTimerRef.current) {
                clearTimeout(copyRemoveTimerRef.current)
            }

            setCopyStatus('Signature link copied to clipboard.')
            setIsCopyToastVisible(true)

            copyHideTimerRef.current = setTimeout(() => {
                setIsCopyToastVisible(false)
                copyHideTimerRef.current = null
            }, 2800)

            copyRemoveTimerRef.current = setTimeout(() => {
                setCopyStatus(null)
                copyRemoveTimerRef.current = null
            }, 3200)
        } catch (error) {
            console.error('Copy signature link error', error)
            if (copyHideTimerRef.current) {
                clearTimeout(copyHideTimerRef.current)
                copyHideTimerRef.current = null
            }
            if (copyRemoveTimerRef.current) {
                clearTimeout(copyRemoveTimerRef.current)
                copyRemoveTimerRef.current = null
            }
            setIsCopyToastVisible(false)
            setCopyStatus(null)
            setEmailStatus({ type: 'error', message: 'No se pudo copiar el enlace. Intenta nuevamente.' })
            setTimeout(() => setEmailStatus(null), 5000)
        }
    }

    const handleEmailUser = (user: User) => {
        setConfirmUser(user)
        setIsConfirmOpen(true)
    }

    const handleQREmailUser = (user: User) => {
        setConfirmQRUser(user)
        setIsQRConfirmOpen(true)
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

    const openEdit = (user: User) => {
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
    }

    const renderActions = (user: User) => (
        <div className="flex justify-end gap-1">
            <button type="button" onClick={() => handleEmailUser(user)} className={iconBtn} aria-label="Send consent email" title="Send consent email">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => handleQREmailUser(user)}
                disabled={!user.has_signed}
                className={iconBtn}
                aria-label="Send QR ticket"
                title={user.has_signed ? 'Send QR ticket' : 'Sign the consent first to send the QR ticket'}
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
            </button>
            <button type="button" onClick={() => { void handleCopySignatureLink(user) }} className={iconBtn} aria-label="Copy signing link" title="Copy signing link">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => { if (user.document_url) window.open(user.document_url, '_blank', 'noopener,noreferrer') }}
                disabled={!user.document_url}
                className={iconBtn}
                aria-label="Open signed document"
                title={user.document_url ? 'Open signed document' : 'No signed document yet'}
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
        </div>
    )

    return (
        <div className="min-h-screen bg-canvas md:bg-parchment">
            {/* Header */}
            <header className="bg-oxblood pt-[env(safe-area-inset-top)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14 md:h-24">
                        <div className="flex items-center gap-4 md:gap-6">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/brand/rev-camp-white.png" alt="Revelation Camp" className="h-8 w-auto md:hidden" />
                            <span className="hidden md:block"><Wordmark className="text-vermilion text-2xl" /></span>
                            <Image
                                width={240}
                                height={160}
                                src="/logos/vida_logo_white.PNG"
                                alt="Vida Ministerio Juvenil"
                                className="hidden md:block h-12 w-auto object-contain"
                            />
                        </div>

                        <div className="flex items-center gap-2 md:gap-3">
                            <PushToggle />
                            <button
                                onClick={handleLogout}
                                aria-label="Logout"
                                className="h-10 w-10 justify-center rounded-full bg-white/10 text-parchment active:bg-white/20 md:w-auto md:rounded-lg md:bg-transparent md:border md:border-parchment/40 md:px-4 md:hover:bg-parchment/10 text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="hidden md:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-36 md:py-12">
                <InstallHint className="mb-5 md:hidden" />
                {isConfirmOpen && confirmUser && (
                    <div className="fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsConfirmOpen(false)}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white rounded-2xl border-2 border-ink/10 overflow-hidden">
                                <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between bg-parchment/60">
                                    <h3 className="text-lg font-bold text-ink">Send confirmation email</h3>
                                    <button onClick={() => setIsConfirmOpen(false)} className="text-ink/60 hover:text-ink">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-3">
                                    <p className="text-sm text-ink/80">Are you sure you want to send the confirmation email to:</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-oxblood">
                                            <span className="text-white font-bold">{confirmUser.names.charAt(0)}</span>
                                        </div>
                                        <div className="text-sm">
                                            <div className="font-bold text-ink">{confirmUser.names} {confirmUser.last_name_1} {confirmUser.last_name_2}</div>
                                            <div className="text-ink/70">{confirmUser.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-ink/10 bg-white flex items-center justify-end gap-3">
                                    <button onClick={() => setIsConfirmOpen(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-ink/80 bg-ink/5 hover:bg-ink/10 transition">Cancel</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const userCopy = confirmUser as User
                                            setIsConfirmOpen(false)
                                            setConfirmUser(null)
                                            // Defer sending to next tick to ensure modal unmounts first
                                            setTimeout(() => { void sendEmailTo(userCopy) }, 0)
                                        }}
                                        className="px-5 py-2 rounded-lg text-sm font-bold text-white transition bg-oxblood hover:bg-oxblood/90"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {isQRConfirmOpen && confirmQRUser && (
                    <div className="fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsQRConfirmOpen(false)}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                            <div className="w-full max-w-md bg-white rounded-2xl border-2 border-ink/10 overflow-hidden">
                                <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between bg-parchment/60">
                                    <h3 className="text-lg font-bold text-ink">Send QR Code Email</h3>
                                    <button onClick={() => setIsQRConfirmOpen(false)} className="text-ink/50 hover:text-ink">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-3">
                                    <p className="text-sm text-ink/80">Are you sure you want to send the QR code boarding pass to:</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-ink">
                                            <span className="text-white font-bold">{confirmQRUser.names.charAt(0)}</span>
                                        </div>
                                        <div className="text-sm">
                                            <div className="font-bold text-ink">{confirmQRUser.names} {confirmQRUser.last_name_1} {confirmQRUser.last_name_2}</div>
                                            <div className="text-ink/70">{confirmQRUser.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-ink/10 bg-white flex items-center justify-end gap-3">
                                    <button onClick={() => setIsQRConfirmOpen(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-ink/80 bg-ink/5 hover:bg-ink/10 transition">Cancel</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const userCopy = confirmQRUser as User
                                            setIsQRConfirmOpen(false)
                                            setConfirmQRUser(null)
                                            // Defer sending to next tick to ensure modal unmounts first
                                            setTimeout(() => { void sendQRCodeEmail(userCopy) }, 0)
                                        }}
                                        className="px-5 py-2 rounded-lg text-sm font-bold text-white transition bg-ink hover:bg-ink/90"
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
                            <div className="w-full max-w-md bg-white rounded-2xl border-2 border-vermilion/20 overflow-hidden">
                                <div className="px-6 py-5 border-b border-vermilion/20 flex items-center justify-between bg-vermilion/5">
                                    <h3 className="text-lg font-bold text-oxblood">Delete Participant</h3>
                                    <button onClick={() => { if (!isDeleting) setIsDeleteConfirmOpen(false) }} className="text-ink/50 hover:text-ink">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    <p className="text-sm text-ink/80">¿Estás seguro de que deseas eliminar a:</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-vermilion/10">
                                            <span className="text-oxblood font-bold">{editingUser.names.charAt(0)}</span>
                                        </div>
                                        <div className="text-sm">
                                            <div className="font-bold text-ink">{editingUser.names} {editingUser.last_name_1} {editingUser.last_name_2}</div>
                                            <div className="text-ink/70">C.C. {editingUser.national_id}</div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-vermilion/5 border border-vermilion/20 p-4 text-sm text-oxblood">
                                        Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a este participante.
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-vermilion/20 bg-white flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { if (!isDeleting) setIsDeleteConfirmOpen(false) }}
                                        className="px-5 py-2 rounded-lg text-sm font-bold text-ink/80 bg-ink/5 hover:bg-ink/10 transition"
                                        disabled={isDeleting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { void handleDeleteParticipant() }}
                                        className="px-5 py-2 rounded-lg text-sm font-bold text-oxblood bg-white border-2 border-vermilion hover:bg-vermilion/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
                <div className="mb-5 flex items-end justify-between gap-4 md:mb-8">
                    <div>
                        <h1 className="font-display text-[1.75rem] leading-tight md:text-4xl text-oxblood">Participants</h1>
                        <p className="mt-0.5 text-sm text-ink/60 md:text-base">{stats.total} registered for {camp.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { void fetchUsers(getActiveFilters(), { silent: false }); }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-card transition-colors active:bg-ink/5 md:rounded-lg md:shadow-none md:border md:border-ink/15 md:hover:bg-ink/5"
                            aria-label="Refresh list"
                            title="Refresh list"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M20 20v-5h-.581m-15.357-2a8.003 8.003 0 0015.357 2" />
                            </svg>
                        </button>
                        <button type="button" onClick={openAdd} className={`${primaryBtn} max-md:hidden`}>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Participant
                        </button>
                    </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 md:mb-8 md:gap-4">
                    <StatCard label="Consents signed" value={stats.signed} total={stats.total} bar="bg-glass" />
                    <StatCard label="Checked in" value={stats.checkedIn} total={stats.total} bar="bg-oxblood" />
                </div>

                {/* Participants: status pills, filters and list (cards on phones, one table card from md) */}
                <div className="relative md:overflow-hidden md:rounded-2xl md:border md:border-ink/10 md:bg-white">
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:border-b md:border-ink/10 md:p-2">
                        {statusTabs.map((tab) => {
                            const active = isTabActive(tab.patch)
                            return (
                                <button
                                    key={tab.label}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => handleStatusTab(tab.patch)}
                                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-oxblood text-parchment' : 'bg-white text-ink/70 shadow-card md:shadow-none md:hover:bg-ink/5'}`}
                                >
                                    {tab.dot && !active && <span className={`h-2 w-2 rounded-full ${tab.dot}`} aria-hidden="true" />}
                                    {tab.label} <span className="tabular-nums">({tab.count})</span>
                                </button>
                            )
                        })}
                    </div>
                    <div className="relative mt-3 md:hidden">
                        <label htmlFor="quick-search" className="sr-only">Search by name or C.C.</label>
                        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                        </svg>
                        <input
                            id="quick-search"
                            type="search"
                            placeholder="Search name or C.C."
                            autoComplete="off"
                            value={filters.p_national_id || filters.p_name}
                            onChange={(e) => handleQuickSearch(e.target.value)}
                            className="h-12 w-full rounded-full bg-white pl-12 pr-4 text-base text-ink shadow-card placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-oxblood/30"
                        />
                    </div>
                    <div className="hidden flex-wrap items-center gap-2 border-b border-ink/10 px-4 py-3 md:flex">
                        <label htmlFor="filter-name" className="sr-only">Name</label>
                        <input
                            id="filter-name"
                            type="text"
                            placeholder="Name"
                            className={`${toolbarField} w-full sm:w-44`}
                            value={filters.p_name}
                            onChange={(e) => handleFilterChange('p_name', e.target.value)}
                        />
                        <label htmlFor="filter-email" className="sr-only">Email</label>
                        <input
                            id="filter-email"
                            type="text"
                            placeholder="Email"
                            className={`${toolbarField} w-full sm:w-52`}
                            value={filters.p_email}
                            onChange={(e) => handleFilterChange('p_email', e.target.value)}
                        />
                        <label htmlFor="filter-national-id" className="sr-only">National ID</label>
                        <input
                            id="filter-national-id"
                            type="text"
                            inputMode="numeric"
                            placeholder="National ID"
                            className={`${toolbarField} w-full sm:w-40`}
                            value={filters.p_national_id}
                            onChange={(e) => handleFilterChange('p_national_id', e.target.value)}
                        />
                        <label htmlFor="filter-gender" className="sr-only">Gender</label>
                        <select
                            id="filter-gender"
                            className={toolbarField}
                            value={filters.p_gender}
                            onChange={(e) => handleFilterChange('p_gender', e.target.value)}
                        >
                            <option value="">All genders</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Femenino">Femenino</option>
                        </select>
                        <label htmlFor="filter-age" className="sr-only">Age</label>
                        <select
                            id="filter-age"
                            className={toolbarField}
                            value={filters.p_age_group}
                            onChange={(e) => handleFilterChange('p_age_group', e.target.value)}
                        >
                            <option value="">All ages</option>
                            <option value="minors">Minors (&lt; 18)</option>
                            <option value="adults">Adults (≥ 18)</option>
                        </select>
                        <button type="button" onClick={clearFilters} className="ml-auto px-2 text-sm font-semibold text-oxblood hover:text-vermilion">
                            Clear filters
                        </button>
                    </div>
                    {emailStatus && (
                        <div className={`fixed bottom-32 inset-x-4 md:inset-x-auto md:bottom-6 md:right-6 z-50 px-6 py-4 rounded-lg border-2 transform transition-colors ease-out ${emailStatus.type === 'success'
                            ? 'bg-white border-glass/40 text-glass'
                            : emailStatus.type === 'error'
                                ? 'bg-white border-vermilion/50 text-oxblood'
                                : 'bg-white border-ink/20 text-ink'
                            } animate-[slideInRight_0.3s_ease-out]`}>
                            <div className="flex items-center gap-3">
                                {emailStatus.type === 'success' ? (
                                    <div className="flex-shrink-0 w-10 h-10 bg-glass rounded-full flex items-center justify-center animate-[scaleIn_0.4s_ease-out]">
                                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                ) : emailStatus.type === 'error' ? (
                                    <div className="flex-shrink-0 w-10 h-10 bg-vermilion rounded-full flex items-center justify-center animate-[shake_0.4s_ease-out]">
                                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0 w-10 h-10 bg-ink rounded-full flex items-center justify-center">
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
                                <div className="h-8 w-8 border-2 border-vermilion border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm font-semibold text-ink/70">Updating participants...</span>
                            </div>
                        </div>
                    )}
                    {checkoutError && (
                        <div className="mx-8 mt-6 rounded-2xl border border-vermilion/40 bg-vermilion/5 px-6 py-4 text-sm text-oxblood">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <svg className="h-5 w-5 text-oxblood" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-semibold">{checkoutError}</span>
                                </div>
                                <button
                                    onClick={() => setCheckoutError(null)}
                                    className="text-ink/50 hover:text-ink transition-colors duration-200"
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
                            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-ink/15 border-t-4 border-t-vermilion"></div>
                            <p className="mt-6 text-ink/80 font-semibold text-lg">Loading participants...</p>
                            <div className="mt-3 flex justify-center">
                                <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-parchment text-oxblood">
                                    <div className="w-2 h-2 rounded-full animate-pulse bg-oxblood"></div>
                                    <span className="text-sm font-medium">Please wait...</span>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <div className="inline-block bg-vermilion/10 rounded-2xl p-6 mb-6">
                                <svg className="h-12 w-12 text-oxblood" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-oxblood font-bold text-lg">{error}</p>
                        </div>
                    ) : (
                        <div>
                            <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full">
                                <thead className="border-b border-ink/10 bg-parchment/30">
                                    <tr className="text-left text-sm font-semibold text-ink/70">
                                        <th scope="col" className="px-6 py-3">Participant</th>
                                        <th scope="col" className="px-6 py-3">Contact</th>
                                        <th scope="col" className="px-6 py-3">Consent</th>
                                        <th scope="col" className="px-6 py-3">Check-in</th>
                                        <th scope="col" className="px-6 py-3 text-center">Check-out</th>
                                        <th scope="col" className="px-6 py-3">Manager</th>
                                        <th scope="col" className="px-6 py-3">Created</th>
                                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink/10">
                                    {filteredUsers.map((user: User) => (
                                        <tr key={user.id} onClick={() => openEdit(user)} className="cursor-pointer transition-colors hover:bg-parchment/40">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-oxblood/10 text-sm font-semibold text-oxblood" aria-hidden="true">
                                                        {user.names.charAt(0)}{user.last_name_1?.charAt(0)}
                                                    </span>
                                                    <div>
                                                        <div className="whitespace-nowrap font-semibold text-ink">
                                                            {user.names} {user.last_name_1} {user.last_name_2}
                                                        </div>
                                                        <div className="mt-0.5 flex gap-3 whitespace-nowrap text-xs text-ink/60">
                                                            <span className="tabular-nums">{Number(user.age) < 18 ? 'T.I.' : 'C.C.'} {user.national_id}</span>
                                                            <span>{user.age} years</span>
                                                            <span>{user.gender}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="text-ink">{user.email}</div>
                                                <div className="mt-0.5 tabular-nums text-ink/60">{user.phone_number}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`${badge} ${user.has_signed ? 'bg-glass/10 text-glass' : 'bg-vermilion/10 text-oxblood'}`}>
                                                    {user.has_signed ? 'Signed' : 'Not signed'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`${badge} ${user.checked_in ? 'bg-glass/10 text-glass' : 'bg-ink/5 text-ink/60'}`}>
                                                    {user.checked_in ? 'Checked in' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={user.checked_out}
                                                    onChange={(e) => handleCheckOutUpdate(user, e.target.checked)}
                                                    disabled={!user.checked_in}
                                                    aria-label={`Checked out: ${user.names} ${user.last_name_1}`}
                                                    title={!user.checked_in ? "Cannot check out - not checked in yet" : "Click to check out"}
                                                    className="h-5 w-5 cursor-pointer accent-glass disabled:cursor-not-allowed disabled:opacity-40"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-ink/70">
                                                {user.manager_id
                                                    ? (managerNames[user.manager_id] || 'Cargando...')
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums text-ink/70">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                {renderActions(user)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>

                            <ul className="mt-4 space-y-3 md:hidden">
                                {filteredUsers.map((user: User) => (
                                    <li key={user.id} className="rounded-[20px] bg-white p-4 shadow-card">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-oxblood/10 text-sm font-semibold text-oxblood" aria-hidden="true">
                                                {user.names.charAt(0)}{user.last_name_1?.charAt(0)}
                                            </span>
                                            <button type="button" onClick={() => openEdit(user)} className="min-w-0 flex-1 rounded-xl text-left active:opacity-70">
                                                <span className="block font-semibold text-ink">
                                                    {user.names} {user.last_name_1} {user.last_name_2}
                                                </span>
                                                <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink/60">
                                                    <span className="tabular-nums">{Number(user.age) < 18 ? 'T.I.' : 'C.C.'} {user.national_id}</span>
                                                    <span>{user.age} years</span>
                                                    {user.manager_id && <span>Manager: {managerNames[user.manager_id] || '...'}</span>}
                                                </span>
                                                <span className="mt-2 flex flex-wrap gap-1.5">
                                                    <span className={`${badge} ${user.has_signed ? 'bg-glass/10 text-glass' : 'bg-vermilion/10 text-oxblood'}`}>
                                                        {user.has_signed ? 'Signed' : 'Not signed'}
                                                    </span>
                                                    <span className={`${badge} ${user.checked_in ? 'bg-glass/10 text-glass' : 'bg-ink/5 text-ink/60'}`}>
                                                        {user.checked_in ? 'Checked in' : 'Not checked in'}
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-3">
                                            <label className={`flex items-center gap-2.5 text-sm text-ink/70 ${user.checked_in ? '' : 'opacity-40'}`}>
                                                {/* switch: native checkbox restyled like the iOS/Android toggle */}
                                                <input
                                                    type="checkbox"
                                                    role="switch"
                                                    checked={user.checked_out}
                                                    onChange={(e) => handleCheckOutUpdate(user, e.target.checked)}
                                                    disabled={!user.checked_in}
                                                    className="relative h-7 w-12 flex-none cursor-pointer appearance-none rounded-full bg-ink/15 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-6 before:w-6 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-glass checked:before:translate-x-5 disabled:cursor-not-allowed"
                                                />
                                                Checked out
                                            </label>
                                            {renderActions(user)}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {filteredUsers.length === 0 && (
                                <div className="px-6 py-16 text-center">
                                    <p className="font-semibold text-ink">No participants match these filters</p>
                                    <p className="mt-1 text-sm text-ink/60">Change the search or show everyone again.</p>
                                    <button type="button" onClick={clearFilters} className={`${secondaryBtn} mt-4`}>
                                        Clear filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <StaffNav onAdd={openAdd} />

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm bg-ink/60 md:items-center md:overflow-y-auto md:px-6 md:py-6">
                    <div className="w-full max-w-4xl max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] overflow-y-auto overscroll-contain bg-white rounded-t-[28px] pb-[env(safe-area-inset-bottom)] animate-[sheetUp_0.25s_ease-out] md:max-h-none md:overflow-hidden md:rounded-2xl md:border-2 md:border-ink/10 md:my-8 md:pb-0 md:animate-none">
                        <div className="sticky top-0 z-20 flex justify-center bg-white pt-2 md:hidden" aria-hidden="true"><span className="h-1.5 w-10 rounded-full bg-ink/15" /></div>
                        <div className="flex items-center justify-between px-5 py-4 md:px-6 border-b-2 border-ink/10 sticky top-3.5 md:top-0 bg-white z-10">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-oxblood">
                                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <h2 className="font-display text-2xl text-oxblood">{isEditing ? 'Edit Participant' : 'Add Participant'}</h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-ink/60 hover:text-ink transition-all duration-200 p-2 rounded-2xl hover:bg-ink/5"
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
                                    <div className="rounded-2xl border border-vermilion/40 bg-vermilion/5 px-6 py-4 text-sm text-oxblood">
                                        <div className="flex items-center space-x-3">
                                            <svg className="h-5 w-5 text-oxblood" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="font-semibold">{formSubmitError}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="names">
                                            Names *
                                        </label>
                                        <input
                                            id="names"
                                            name="names"
                                            type="text"
                                            value={formData.names}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.names && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.names}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="age">
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
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.age && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.age}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="last_name_1">
                                            First Last Name *
                                        </label>
                                        <input
                                            id="last_name_1"
                                            name="last_name_1"
                                            type="text"
                                            value={formData.last_name_1}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.last_name_1 && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.last_name_1}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="last_name_2">
                                            Second Last Name *
                                        </label>
                                        <input
                                            id="last_name_2"
                                            name="last_name_2"
                                            type="text"
                                            value={formData.last_name_2}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.last_name_2 && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.last_name_2}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="email">
                                            Email *
                                        </label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.email && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.email}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="phone_number">
                                            Phone Number *
                                        </label>
                                        <input
                                            id="phone_number"
                                            name="phone_number"
                                            type="tel"
                                            value={formData.phone_number}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.phone_number && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.phone_number}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="gender">
                                            Gender *
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="gender"
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-4 py-3 pr-14 border border-ink/20 rounded-lg bg-white text-ink appearance-none transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                            >
                                                <option value="">Select gender</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                                <svg className="h-5 w-5 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {formErrors.gender && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.gender}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="national_id">
                                            National ID *
                                        </label>
                                        <input
                                            id="national_id"
                                            name="national_id"
                                            type="text"
                                            value={formData.national_id}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.national_id && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.national_id}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="emergency_contact">
                                            Emergency Contact
                                        </label>
                                        <input
                                            id="emergency_contact"
                                            name="emergency_contact"
                                            type="text"
                                            placeholder="Name - Relationship"
                                            value={formData.emergency_contact}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.emergency_contact && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.emergency_contact}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-ink mb-1.5" htmlFor="emergency_contact_phone_number">
                                            Emergency Contact Phone
                                        </label>
                                        <input
                                            id="emergency_contact_phone_number"
                                            name="emergency_contact_phone_number"
                                            type="tel"
                                            value={formData.emergency_contact_phone_number}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-ink/20 rounded-lg bg-white text-ink placeholder-ink/40 transition-colors focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
                                        />
                                        {formErrors.emergency_contact_phone_number && (
                                            <p className="mt-1.5 text-sm text-oxblood font-semibold">{formErrors.emergency_contact_phone_number}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4 pb-3 sm:flex sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:pt-6 sm:pb-0 border-t-2 border-ink/10 sticky bottom-0 bg-white z-10">
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            disabled={isSubmitting || isDeleting}
                                            className="col-span-2 order-last w-full sm:order-none sm:w-auto px-8 py-2 sm:py-4 rounded-lg text-sm font-bold text-oxblood bg-white sm:border-2 sm:border-vermilion hover:bg-vermilion/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isDeleting ? 'Deleting...' : 'Delete Participant'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="w-full sm:w-auto px-4 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-lg text-sm font-bold text-ink/80 bg-ink/5 hover:bg-ink/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || isDeleting}
                                        className="w-full sm:w-auto px-4 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 bg-oxblood hover:bg-oxblood/90"
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

            {copyStatus && (
                <div
                    className={`fixed ${emailStatus ? 'bottom-52 md:bottom-24' : 'bottom-32 md:bottom-6'} inset-x-4 md:inset-x-auto md:right-6 z-[70] px-5 py-3 rounded-lg border border-glass/40 bg-white flex items-center gap-3 transition-all duration-300 ease-in-out ${isCopyToastVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}`}
                >
                    <div className="flex-shrink-0 w-8 h-8 bg-glass rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-glass">{copyStatus}</span>
                </div>
            )}
        </div>
    )
}
