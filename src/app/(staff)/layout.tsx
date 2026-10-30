import type { Metadata } from 'next'
import Splash from '@/components/Splash'

// iOS ignores the manifest for launch screens: it needs one image per screen size (portrait), matched by media query
const splash = [
    [1320, 2868, 440, 956, 3],
    [1290, 2796, 430, 932, 3],
    [1206, 2622, 402, 874, 3],
    [1179, 2556, 393, 852, 3],
    [1284, 2778, 428, 926, 3],
    [1170, 2532, 390, 844, 3],
    [1242, 2688, 414, 896, 3],
    [1125, 2436, 375, 812, 3],
    [828, 1792, 414, 896, 2],
    [750, 1334, 375, 667, 2],
].map(([w, h, dw, dh, dpr]) => ({
    url: `/splash/apple-splash-${w}x${h}.png`,
    media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}))

// Only staff routes link the manifest, so "Add to Home Screen" installs the staff tool and the public landing stays a plain page
export const metadata: Metadata = {
    title: 'Staff',
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Revelation', statusBarStyle: 'black-translucent', startupImage: splash },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Splash />
        </>
    )
}
