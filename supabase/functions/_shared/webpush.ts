import { Buffer } from 'node:buffer'
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto'

// Minimal Web Push sender on node:crypto: RFC 8291 payload encryption + RFC 8292 VAPID auth.
// Checked against the RFC 8291 test vector by scripts/webpush-check.mjs.

export interface PushTarget {
    endpoint: string
    p256dh: string
    auth: string
}

const b64u = (s: string) => Buffer.from(s, 'base64url')
const hkdf = (ikm: Buffer, salt: Buffer, info: string | Buffer, length: number) =>
    Buffer.from(hkdfSync('sha256', ikm, salt, typeof info === 'string' ? Buffer.from(info) : info, length))

// aes128gcm with a single record; salt and asPrivate are fixed only by the test vector check
export function encryptPayload(plaintext: Buffer, target: Pick<PushTarget, 'p256dh' | 'auth'>, salt = randomBytes(16), asPrivate?: Buffer) {
    const ecdh = createECDH('prime256v1')
    if (asPrivate) ecdh.setPrivateKey(asPrivate)
    else ecdh.generateKeys()
    const asPublic = ecdh.getPublicKey()
    const uaPublic = b64u(target.p256dh)

    const ikm = hkdf(ecdh.computeSecret(uaPublic), b64u(target.auth), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32)
    const cek = hkdf(ikm, salt, 'Content-Encoding: aes128gcm\0', 16)
    const nonce = hkdf(ikm, salt, 'Content-Encoding: nonce\0', 12)

    const cipher = createCipheriv('aes-128-gcm', cek, nonce)
    // 0x02 marks the last (and only) record
    const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])

    const header = Buffer.alloc(21)
    salt.copy(header)
    header.writeUInt32BE(4096, 16)
    header[20] = asPublic.length
    return Buffer.concat([header, asPublic, ciphertext])
}

// ES256 JWT for the push service origin; keys are base64url (65-byte public point, 32-byte private scalar)
export function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string) {
    const pub = b64u(publicKey)
    const key = createPrivateKey({
        format: 'jwk',
        key: { kty: 'EC', crv: 'P-256', d: privateKey, x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') },
    })
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`
    const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
    return `vapid t=${unsigned}.${signature}, k=${publicKey}`
}

// Returns the push service status: 201 sent, 404/410 the subscription no longer exists
export async function sendPush(target: PushTarget, payload: object, vapid: { publicKey: string; privateKey: string; subject: string }) {
    const response = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
            Authorization: vapidAuthorization(target.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
            TTL: '86400',
            Urgency: 'normal',
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(encryptPayload(Buffer.from(JSON.stringify(payload)), target)),
    })
    return response.status
}
