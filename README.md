# Camp Platform Admin Dashboard

A modern admin dashboard for managing camp users and registrations, built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 **Authentication**: Secure login with Supabase Auth
- 👥 **User Management**: View and filter all registered users
- 🔍 **Advanced Filtering**: Filter by email, gender, name, and national ID
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, professional interface inspired by Agendrix

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Set up authentication in your Supabase dashboard
3. Create the `get_all_people` RPC function in your Supabase database:

```sql
CREATE OR REPLACE FUNCTION get_all_people(
  p_email TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_national_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  age INTEGER,
  email TEXT,
  names TEXT,
  gender TEXT,
  camp_total NUMERIC,
  checked_in BOOLEAN,
  created_at TIMESTAMPTZ,
  has_signed BOOLEAN,
  checked_out BOOLEAN,
  last_name_1 TEXT,
  last_name_2 TEXT,
  national_id TEXT,
  phone_number TEXT,
  emergency_contact TEXT,
  emergency_contact_phone_number TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.age,
    u.email,
    u.names,
    u.gender,
    u.camp_total,
    u.checked_in,
    u.created_at,
    u.has_signed,
    u.checked_out,
    u.last_name_1,
    u.last_name_2,
    u.national_id,
    u.phone_number,
    u.emergency_contact,
    u.emergency_contact_phone_number
  FROM users u
  WHERE 
    (p_email IS NULL OR u.email ILIKE '%' || p_email || '%')
    AND (p_gender IS NULL OR u.gender = p_gender)
    AND (p_name IS NULL OR u.names ILIKE '%' || p_name || '%')
    AND (p_national_id IS NULL OR u.national_id ILIKE '%' || p_national_id || '%')
  ORDER BY u.created_at DESC;
END;
$$;
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Login**: Navigate to `/login` and sign in with your Supabase credentials
2. **Dashboard**: After login, you'll be redirected to the dashboard where you can:
   - View all registered users
   - Filter users by email, gender, name, or national ID
   - Search users in real-time
   - See user status (Checked In, Checked Out, Pending)

## User Data Structure

The application expects user data in the following format:

```typescript
interface User {
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
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Technologies Used

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **Supabase**: Backend-as-a-Service for authentication and database
- **React 19**: Latest React features

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.