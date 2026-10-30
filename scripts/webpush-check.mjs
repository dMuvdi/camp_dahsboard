// Self-check for supabase/functions/_shared/webpush.ts against the RFC 8291 Appendix A test vector and a VAPID signature round trip.
// Run: node --experimental-strip-types scripts/webpush-check.mjs
import assert from 'node:assert/strict'
import { createECDH, createPublicKey, verify } from 'node:crypto'
import { encryptPayload, vapidAuthorization } from '../supabase/functions/_shared/webpush.ts'

const b64u = (s) => Buffer.from(s.replace(/\s/g, ''), 'base64url')

const out = encryptPayload(
    b64u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
    {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    },
    b64u('DGv6ra1nlYgDCS1FRnbzlw'),
    b64u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
)
// the full message body from RFC 8291 Section 5
const expected = b64u(`DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
    mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
    pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`)
assert.equal(out.toString('base64url'), expected.toString('base64url'), 'RFC 8291 test vector')

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const pub = ecdh.getPublicKey()
const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', pub.toString('base64url'), ecdh.getPrivateKey().toString('base64url'), 'mailto:test@example.com')
const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)
const [h, p, s] = jwt.split('.')
assert.equal(JSON.parse(Buffer.from(p, 'base64url')).aud, 'https://fcm.googleapis.com')
const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } })
assert.ok(verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'VAPID signature')
assert.equal(k, pub.toString('base64url'))

console.log('webpush: ok')
