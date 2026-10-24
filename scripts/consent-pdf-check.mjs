// Self-check for src/lib/consentPdf.ts: builds the three consent PDFs with sample data.
// Run: node --experimental-strip-types scripts/consent-pdf-check.mjs [outDir]   (writes the PDFs when outDir is given)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildConsentPdf } from '../src/lib/consentPdf.ts'
import { adultParagraphs, minorClauses, minorParagraphs } from '../src/lib/consentText.ts'

const root = path.resolve(import.meta.dirname, '..')
const png = (file) => new Uint8Array(fs.readFileSync(path.join(root, 'public', file)))
const logos = { camp: png('logos/revelation_logo_white.png'), vida: png('logos/vida_logo_white.PNG') }
const signature = png('brand/rev-camp-white.png') // any PNG stands in for a drawn signature
const signedAt = new Date('2026-10-24T20:15:00Z')

const cases = {
    adult: {
        paragraphs: adultParagraphs({ name: 'Ana María Gómez Ríos', nationalId: '1000000000', date: '24 de octubre de 2026' }),
        signatures: [{ image: signature, name: 'Ana María Gómez Ríos', idLabel: 'C.C. 1000000000', caption: 'Firma del participante' }],
    },
    minor: {
        paragraphs: minorParagraphs({ tutorName: 'Samuel Mejía Torres', tutorNationalId: '1000007919', minorName: 'Valentina Pérez Luna', minorNationalId: '1100015838' }),
        clauses: minorClauses({ option: 'parent' }),
        signatures: [{ image: signature, name: 'Samuel Mejía Torres', idLabel: 'C.C. 1000007919', caption: 'Firma del padre, madre o tutor(a)' }],
    },
    delegate: {
        paragraphs: minorParagraphs({ tutorName: 'María Luna Díaz', tutorNationalId: '22334455', minorName: 'Valentina Pérez Luna', minorNationalId: '1100015838' }),
        clauses: minorClauses({ option: 'delegate', delegateName: 'Samuel Mejía Torres', delegateNationalId: '1000007919' }),
        signatures: [
            { image: signature, name: 'María Luna Díaz', idLabel: 'C.C. 22334455', caption: 'Firma del padre, madre o tutor(a)' },
            { image: signature, name: 'Samuel Mejía Torres', idLabel: 'C.C. 1000007919', caption: 'Firma del responsable en el campamento' },
        ],
    },
}

const outDir = process.argv[2]
for (const [name, input] of Object.entries(cases)) {
    const pdf = await buildConsentPdf({ ...input, signedAt, documentId: '00000000-0000-0000-0000-000000000000', logos })
    const head = Buffer.from(pdf.subarray(0, 5)).toString()
    assert.equal(head, '%PDF-', `${name}: not a PDF`)
    assert.ok(pdf.length > 5000, `${name}: suspiciously small PDF`)
    if (outDir) fs.writeFileSync(path.join(outDir, `consent-${name}.pdf`), pdf)
}
console.log('consent pdf: ok')
