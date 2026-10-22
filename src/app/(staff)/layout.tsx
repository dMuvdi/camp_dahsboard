import type { Metadata } from 'next'

// Only staff routes link the manifest, so "Add to Home Screen" installs the staff tool and the public landing stays a plain page
export const metadata: Metadata = {
    title: 'Staff',
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Revelation', statusBarStyle: 'default' },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    return children
}
