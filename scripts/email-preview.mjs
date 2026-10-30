// Renders the camp emails to HTML files with the real images, to check template edits before deploying.
// Run: npm run preview:email   -> open email-preview/*.html in a browser
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { c, contractEmail, ticketEmail } from '../supabase/functions/_shared/emailTemplates.ts'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'email-preview')
fs.mkdirSync(out, { recursive: true })

const QRCode = createRequire(import.meta.url)('qrcode')
await QRCode.toFile(path.join(out, 'qr.png'), 'preview-participant', { margin: 1, scale: 8, color: { dark: c.ink, light: '#ffffff' } })

// the sender attaches these under the same CIDs
const images = {
    camp_logo: path.join(root, 'public/logos/revelation_logo_white.png'),
    vida_logo: path.join(root, 'public/logos/vida_logo_white.PNG'),
    boat: path.join(root, 'public/brand/boat-parchment.png'),
    'qr-code': path.join(out, 'qr.png'),
}
const withImages = (html) => html.replace(/cid:([\w-]+)/g, (_, cid) => pathToFileURL(images[cid]).href)

const emails = {
    'ticket.html': ticketEmail('Ana María Gómez Ríos'),
    'contract.html': contractEmail('Ana María Gómez Ríos', 'https://camp-dahsboard.vercel.app/contract_sign/preview'),
    'delegate.html': contractEmail('Samuel Mejía Torres', 'https://camp-dahsboard.vercel.app/delegate_signature/preview', 'Valentina Pérez Luna'),
}
for (const [file, html] of Object.entries(emails)) {
    fs.writeFileSync(path.join(out, file), withImages(html))
    console.log(path.join(out, file))
}
