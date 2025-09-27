import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our user data
export interface User {
    id: string
    age: number
    email: string
    names: string
    gender: string
    camp_total: number
    checked_in: boolean
    created_at: string
    has_signed: boolean
    checked_out: boolean
    last_name_1: string
    last_name_2: string
    national_id: string
    phone_number: string
    emergency_contact: string
    emergency_contact_phone_number: string
}

// Function to fetch all people using the RPC
export async function getAllPeople(filters: {
    p_email?: string
    p_gender?: string
    p_name?: string
    p_national_id?: string
} = {}) {
    try {
        const { data, error } = await supabase.rpc('get_all_people', filters)

        if (error) {
            console.error('Error fetching people:', error)
            throw error
        }

        return data as User[]
    } catch (error) {
        console.error('Error in getAllPeople:', error)
        throw error
    }
}
